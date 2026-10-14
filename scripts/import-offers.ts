#!/usr/bin/env node
/**
 * import-offers.ts — CLI import ofert z XLSX/CSV (opcja C, etap F1).
 *
 * Powiela DOKLADNIE ksztalt payloadow budowanych przez frontend
 * (public/js/import-export/{rury,studnie}/externalImport.js + toolbar.js),
 * ale: liczby parsowane scisle (zakaz cichego 0, D-FIX-2), rabat w skali
 * 0-100 (decyzja: zgodnie z wellComponentSchema, BEZ /100), audyt
 * best-effort poza zapisem (I-012), Idempotency-Key per oferta (I-004).
 * Logika biznesowa zyje WYLACZNIE na serwerze (POST /api/offers-*) —
 * skrypt nie pisze do DB bezposrednio, nie zmienia logiki biznesowej.
 *
 * Limity (uzasadnienie: tests/importBatchLimits.test.ts, F0):
 * - XLSX > XLSX_MAX_ROWS (100k) -> odrzuc (podziel na CSV; SheetJS CE
 *   nie streamuje, sheetRows to tylko obciecie prefixu).
 * - 1 oferta = 1 POST sekwencyjnie (jak FE; SQLITE_BUSY, connection_limit=1).
 * - Oferta > MAX_ROWS_OFFER wierszy -> blad rekordu (nie wysylaj).
 *
 * Uzycie:
 *   ts-node scripts/import-offers.ts --file import.xlsx --user admin
 *   npm run import:offers -- --file import.xlsx --dry-run
 *
 * Exit: 0 ok (skip tez 0) | 1 bledy rekordow | 2 blad wejscia |
 *       3 blad serwera/abort | 130 SIGINT (checkpoint zapisany).
 */

import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import vm from 'vm';

// quiserings intentionaly minimal — zero nowych zaleznosci (ladujemy
// vendored SheetJS 0.20.3 przez vm, jak w F0; CSV przez readline stdlib).

export const XLSX_MAX_ROWS = 100000;
export const MAX_ROWS_OFFER = 5000;
const MAX_FILE_BYTES = 200 * 1024 * 1024;
const REQUIRED_COLS = ['NUMER_OFERTY', 'INDEKS_CZESCI', 'ILOSC', 'CENA_JEDNOSTKOWA'];
const IDEM_ENDPOINT_RURY = 'cli:import-offers/rury';
const IDEM_ENDPOINT_STUDNIE = 'cli:import-offers/studnie';
// Port DEFAULTS z public/js/import-export/studnie/magazynCodes.js:7-12.
const MAGAZYN_DEFAULTS = {
    dennicaWl: 'WL',
    dennicaKlb: 'M0',
    nadbudowaWl: 'WL',
    nadbudowaKlb: 'M0'
};
const DENNICA_TYPES = ['dennica', 'kineta', 'styczna'];

export interface RowError {
    sheet: string;
    row: number;
    col: string;
    value: string;
    reason: string;
}

export interface OfferGroup {
    number: string;
    rows: Record<string, string>[];
}

interface Args {
    file: string;
    format: 'xlsx' | 'csv';
    server: string;
    user: string;
    password: string;
    conflict: 'skip' | 'overwrite' | 'clone';
    onError: 'skip' | 'abort';
    dryRun: boolean;
    reportOut: string;
    resumeFrom: string | null;
    userId: string;
}

function usage(): never {
    console.error(
        'Uzycie: ts-node scripts/import-offers.ts --file <plik> --user <login> ' +
            '[--format xlsx|csv] [--server URL] [--password HASLO] ' +
            '[--conflict skip|overwrite|clone] [--on-error skip|abort] [--dry-run] ' +
            '[--report-out <plik>] [--resume-from <checkpoint>]'
    );
    throw new ExitError(2);
}

// process.exit() + otwarte sockety fetch = crash libuv na Windows
// (UV_HANDLE_CLOSING). Wyjscie wylacznie przez exitCode + naturalny koniec.
class ExitError extends Error {
    code: number;
    constructor(code: number) {
        super(`exit ${code}`);
        this.code = code;
    }
}

function parseArgs(): Args {
    const a = process.argv.slice(2);
    const get = (k: string): string | null => {
        const i = a.indexOf(k);
        return i >= 0 && i + 1 < a.length ? a[i + 1] : null;
    };
    const file = get('--file');
    const user = get('--user') || process.env.SOK_USER || '';
    if (!file || !user) usage();
    const fmtRaw = (get('--format') || path.extname(file as string).toLowerCase()).replace(
        /^\./,
        ''
    );
    if (fmtRaw !== 'xlsx' && fmtRaw !== 'csv') {
        console.error(`[import:offers] Nieznany format: ${fmtRaw} (xlsx|csv)`);
        throw new ExitError(2);
    }
    const conflict = get('--conflict') || 'skip';
    const onError = get('--on-error') || 'skip';
    if (!['skip', 'overwrite', 'clone'].includes(conflict)) usage();
    if (!['skip', 'abort'].includes(onError)) usage();
    return {
        file: file as string,
        format: fmtRaw as 'xlsx' | 'csv',
        server: (get('--server') || process.env.SOK_SERVER || 'http://localhost:3000').replace(
            /\/$/,
            ''
        ),
        user,
        password: get('--password') || process.env.SOK_PASS || '',
        conflict: conflict as Args['conflict'],
        onError: onError as Args['onError'],
        dryRun: a.includes('--dry-run'),
        reportOut: get('--report-out') || `${file as string}.report.json`,
        resumeFrom: get('--resume-from'),
        userId: `cli:${user}`
    };
}

// --- 1:1 porty czyste z FE (xlsxImportShared.js) ---

export function normalizeHeader(h: unknown): string {
    if (!h) return '';
    return String(h).trim().toUpperCase();
}

export function validateHeaders(headers: string[]): string[] {
    return REQUIRED_COLS.filter((c) => !headers.includes(c));
}

export function groupRowsIntoOffers(rows: Record<string, string>[]): OfferGroup[] {
    const grouped: Record<string, OfferGroup> = {};
    for (const row of rows) {
        const key = row['NUMER_OFERTY'] || 'BRAK_NUMERU';
        if (!grouped[key]) grouped[key] = { number: key, rows: [] };
        grouped[key].rows.push(row);
    }
    return Object.values(grouped);
}

// Scisle parsowanie liczb PL/EN. Kontrakt: number|null, nigdy NaN/0.
// Puste/tekst -> null (blad wiersza, D-FIX-2). Ujemne przechodza dalej
// (odrzuca je Zod serwera, nie parser).
export function parsePlNumber(raw: unknown): number | null {
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    if (typeof raw !== 'string') return null;
    let s = raw
        .trim()
        .replace(/[ \u00A0\u202F\u2009]/g, '')
        .replace(/\s*%\s*$/, '');
    if (s === '') return null;
    const c = s.lastIndexOf(',');
    const d = s.lastIndexOf('.');
    if (c > -1 && d > -1) {
        s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (c > -1) {
        s = s.replace(',', '.');
    }
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

function short(v: unknown): string {
    const s = String(v ?? '');
    return s.length > 200 ? s.slice(0, 200) : s;
}

// --- vendor SheetJS (zero nowych deps) ---

function loadVendorXlsx(): {
    read: (...a: unknown[]) => unknown;
    utils: { sheet_to_json: (...a: unknown[]) => Record<string, unknown>[] };
} {
    // Vendor lezy w repo (scripts/../public/vendor). Fallback cwd dla
    // jednorazowych kompilacji weryfikacyjnych poza scripts/.
    const cands = [
        path.join(__dirname, '..', 'public', 'vendor', 'xlsx.full.min.js'),
        path.join(process.cwd(), 'public', 'vendor', 'xlsx.full.min.js')
    ];
    const vendor = cands.find((p) => fs.existsSync(p));
    if (!vendor) throw new Error('Brak vendor SheetJS (public/vendor/xlsx.full.min.js)');
    const code = fs.readFileSync(vendor, 'utf8');
    const sandbox: Record<string, unknown> = {};
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'xlsx.full.min.js' });
    return sandbox.XLSX as {
        read: (...a: unknown[]) => unknown;
        utils: { sheet_to_json: (...a: unknown[]) => Record<string, unknown>[] };
    };
}

// --- parse XLSX ---

function parseXlsxFile(
    file: string,
    warnings: string[]
): { rows: Record<string, string>[]; sheetsSkipped: string[] } {
    const XLSX = loadVendorXlsx();
    const buf = fs.readFileSync(file);
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: false, raw: false }) as {
        SheetNames: string[];
        Sheets: Record<string, unknown>;
    };
    if (!wb.SheetNames.length) throw new Error('Pusty workbook (brak arkuszy)');
    const sheetsSkipped = wb.SheetNames.slice(1);
    if (sheetsSkipped.length) {
        warnings.push(
            `Pominieto arkusze (${sheetsSkipped.length}): ${sheetsSkipped.join(', ')} — import tylko pierwszego`
        );
    }
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const ref = (sheet as { '!ref'?: string })['!ref'];
    if (ref) {
        const m = /:([A-Z]+)(\d+)$/.exec(ref);
        const count = m ? parseInt(m[2], 10) - 1 : 0;
        if (count > XLSX_MAX_ROWS) {
            throw new Error(
                `Arkusz ma ~${count} wierszy (limit ${XLSX_MAX_ROWS}) — podziel na CSV`
            );
        }
    }
    const raw = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    if (!raw.length) throw new Error('Plik XLSX jest pusty');
    const headers = Object.keys(raw[0]).map(normalizeHeader);
    const missing = validateHeaders(headers);
    if (missing.length) throw new Error('Brakujace wymagane kolumny: ' + missing.join(', '));
    const rows = raw.map((row) => {
        const obj: Record<string, string> = {};
        for (const key of Object.keys(row)) obj[normalizeHeader(key)] = String(row[key]).trim();
        return obj;
    });
    return { rows, sheetsSkipped };
}

// --- parse CSV (strumien, O(batch)) ---

function sniffDelimiter(sample: string): string {
    const cands = [',', ';', '\t'];
    let best = ';';
    let bestN = -1;
    for (const d of cands) {
        const n = sample.split('\n')[0].split(d).length;
        if (n > bestN) {
            bestN = n;
            best = d;
        }
    }
    return best;
}

function splitCsvLine(line: string, delim: string): string[] {
    const out: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (q) {
            if (ch === '"') {
                if (line[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else q = false;
            } else cur += ch;
        } else if (ch === '"') q = true;
        else if (ch === delim) {
            out.push(cur);
            cur = '';
        } else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
}

// Bez regex (no-control-regex): kontrolne poza TAB/LF/CR = binarka.
export function looksBinary(sample: string): boolean {
    for (let i = 0; i < sample.length; i++) {
        const c = sample.charCodeAt(i);
        if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) return true;
    }
    return false;
}

async function parseCsvFile(file: string): Promise<Record<string, string>[]> {
    const head = fs.readFileSync(file, { encoding: 'utf8' }).slice(0, 4096);
    if (looksBinary(head)) {
        throw new Error('Plik nie wyglada na CSV (znaki binarne w naglowku)');
    }
    const delim = sniffDelimiter(head);
    const rl = readline.createInterface({
        input: fs.createReadStream(file, { encoding: 'utf8' }),
        crlfDelay: Infinity
    });
    let headers: string[] = [];
    let first = true;
    const rows: Record<string, string>[] = [];
    for await (const line of rl) {
        if (line.trim() === '') continue;
        const cells = splitCsvLine(line, delim);
        if (first) {
            first = false;
            headers = cells.map(normalizeHeader);
            const missing = validateHeaders(headers);
            if (missing.length)
                throw new Error('Brakujace wymagane kolumny: ' + missing.join(', '));
            continue;
        }
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
            obj[h] = (cells[i] ?? '').trim();
        });
        rows.push(obj);
    }
    if (!rows.length) throw new Error('Plik CSV jest pusty');
    return rows;
}

// --- klient HTTP (cookie jar + Origin dla I-010) ---

class Api {
    private cookie = '';
    constructor(private base: string) {}

    private async req(
        method: string,
        url: string,
        body?: unknown,
        idemKey?: string
    ): Promise<{ status: number; json: unknown }> {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        headers['Origin'] = this.base;
        if (this.cookie) headers['Cookie'] = this.cookie;
        if (idemKey) headers['Idempotency-Key'] = idemKey;
        const res = await fetch(this.base + url, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        const setCookie = res.headers.get('set-cookie');
        if (setCookie) {
            const m = /authToken=([^;]+)/.exec(setCookie);
            if (m) this.cookie = `authToken=${m[1]}`;
        }
        let json: unknown = null;
        try {
            json = await res.json();
        } catch {
            json = null;
        }
        return { status: res.status, json };
    }

    get(url: string): Promise<{ status: number; json: unknown }> {
        return this.req('GET', url);
    }

    async audit(
        entityType: string,
        entityId: string,
        details: Record<string, unknown>
    ): Promise<boolean> {
        // Best-effort (I-012): zwraca false zamiast rzucac.
        try {
            const r = await this.req('POST', '/api/feature-flags/audit', {
                entityType,
                entityId,
                action: 'import.external',
                details
            });
            return r.status < 500;
        } catch {
            return false;
        }
    }

    async post(
        url: string,
        body: unknown,
        idemKey?: string
    ): Promise<{ status: number; json: unknown }> {
        // 429: backoff liniowy (max 3 retry). Wysylamy sekwencyjnie 1 POST
        // naraz, wiec 429 oznacza contention z innym pisarzem (SQLITE_BUSY).
        for (let attempt = 0; attempt < 4; attempt++) {
            const r = await this.req('POST', url, body, idemKey);
            if (r.status !== 429 || attempt === 3) return r;
            await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
        }
        throw new Error('unreachable');
    }

    async login(username: string, password: string): Promise<void> {
        if (!password) throw new Error('Brak hasla (--password lub SOK_PASS)');
        const r = await this.req('POST', '/api/auth/login', { username, password });
        if (r.status !== 200 || !this.cookie) {
            throw new Error('Logowanie nieudane (401?) — sprawdz login/haslo');
        }
    }
}

function stablePayloadHash(payload: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

// --- budowa payloadow 1:1 z FE (rury/studnie externalImport.js) ---

export interface BuiltOffer {
    module: 'rury' | 'studnie';
    number: string;
    payload: Record<string, unknown>;
    rowsCount: number;
    wellsCount?: number;
}

export function buildRuryPayload(
    number: string,
    rows: Record<string, string>[],
    errors: RowError[]
): BuiltOffer | null {
    const items: Record<string, unknown>[] = [];
    let transportSeparate = false;
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (normalizeHeader(r['INDEKS_CZESCI']) === 'TR-RURY') {
            transportSeparate = true;
            continue;
        }
        const qty = parsePlNumber(r['ILOSC']);
        const price = parsePlNumber(r['CENA_JEDNOSTKOWA']);
        const rowNo = i + 2;
        if (qty === null || !Number.isInteger(qty) || qty <= 0) {
            errors.push({
                sheet: 'Import',
                row: rowNo,
                col: 'ILOSC',
                value: short(r['ILOSC']),
                reason: 'ilosc-calkowita-dodatnia'
            });
            return null;
        }
        if (price === null || price < 0) {
            errors.push({
                sheet: 'Import',
                row: rowNo,
                col: 'CENA_JEDNOSTKOWA',
                value: short(r['CENA_JEDNOSTKOWA']),
                reason: 'cena-nieujemna'
            });
            return null;
        }
        let discount = 0;
        if (r['RABAT'] !== '') {
            const d = parsePlNumber(r['RABAT']);
            if (d === null || d < 0 || d > 100) {
                errors.push({
                    sheet: 'Import',
                    row: rowNo,
                    col: 'RABAT',
                    value: short(r['RABAT']),
                    reason: 'rabat-0-100'
                });
                return null;
            }
            discount = d;
        }
        const pehdType = r['NR_STUDNI'] || '';
        items.push({
            productId: r['INDEKS_CZESCI'] || '',
            quantity: qty,
            discount,
            unitPrice: price,
            price,
            ...(pehdType ? { pehdType } : {})
        });
    }
    return {
        module: 'rury',
        number,
        payload: {
            offer_number: number,
            number,
            status: 'draft',
            items,
            transportCost: 0,
            transportSeparate
        },
        rowsCount: rows.length
    };
}

export function buildStudniePayload(
    number: string,
    rows: Record<string, string>[],
    typeMap: Map<string, string>,
    magazynCodes: Record<string, string>,
    errors: RowError[]
): BuiltOffer | null {
    // Port _groupRows (studnie/externalImport.js:30-92) + warehouseForCode
    // (studnie/magazynCodes.js:77-83). Bez zmian semantyki; liczby scisle.
    const codes = { ...MAGAZYN_DEFAULTS, ...magazynCodes };
    const partOf = (indeks: string): 'dennica' | 'nadbudowa' | null => {
        const ct = typeMap.get((indeks || '').trim());
        if (ct && DENNICA_TYPES.includes(ct)) return 'dennica';
        if (!ct) return null;
        return 'nadbudowa';
    };
    const warehouseForCode = (code: string, part: 'dennica' | 'nadbudowa'): string => {
        const n = (code || '').trim().toUpperCase();
        if (!n) return 'Kluczbork';
        const wlCode = part === 'dennica' ? codes.dennicaWl : codes.nadbudowaWl;
        return n === wlCode ? 'Włocławek' : 'Kluczbork';
    };
    const dataRows = rows.filter((r) => normalizeHeader(r['INDEKS_CZESCI']) !== 'TR-STUDNIE');
    const transportSeparate = dataRows.length !== rows.length;
    interface Well {
        dn?: string;
        depth: number;
        name: string;
        magazyn: string;
        magazynDennica: string | null;
        magazynNadbudowa: string | null;
        lp: number;
        components: Record<string, unknown>[];
    }
    const wellMap: Record<string, Well> = {};
    for (let i = 0; i < dataRows.length; i++) {
        const r = dataRows[i];
        const rowNo = i + 2;
        const wellName = r['NR_STUDNI'] || 'Studnia_1';
        if (!wellMap[wellName]) {
            const lp = parsePlNumber(r['LP']);
            const depthRaw = (r['GLEBOKOSC'] || '').trim();
            const depth = depthRaw === '' ? 0 : parsePlNumber(depthRaw);
            if (depth === null || !Number.isInteger(depth) || depth < 0) {
                errors.push({
                    sheet: 'Import',
                    row: rowNo,
                    col: 'GLEBOKOSC',
                    value: short(r['GLEBOKOSC']),
                    reason: 'glebokosc-calkowita-nieujemna'
                });
                return null;
            }
            wellMap[wellName] = {
                // dn: SREDNICA pusta -> KLUCZ POMINIETY (nie ''). Schema:
                // dn: union([number, string.min(1)]).optional() — '' failuje
                // 400, brak klucza przechodzi. FE wysyla '' (upstream 400
                // przy pustej SREDNICY); CLI omija te 400 swiadomie.
                ...(r['SREDNICA'] ? { dn: r['SREDNICA'] } : {}),
                depth,
                name: wellName,
                magazyn: 'Kluczbork',
                magazynDennica: null,
                magazynNadbudowa: null,
                lp: lp !== null && Number.isInteger(lp) ? lp : Object.keys(wellMap).length + 1,
                components: []
            };
        }
        const well = wellMap[wellName];
        const part = partOf(r['INDEKS_CZESCI']);
        const wh = warehouseForCode(r['MAGAZYN'], part || 'nadbudowa');
        if (part === 'dennica') well.magazynDennica = wh;
        else if (part === 'nadbudowa') well.magazynNadbudowa = wh;
        else if (well.magazynDennica == null && well.magazynNadbudowa == null) well.magazyn = wh;
        const qty = parsePlNumber(r['ILOSC']);
        const price = parsePlNumber(r['CENA_JEDNOSTKOWA']);
        if (qty === null || !Number.isInteger(qty) || qty <= 0) {
            errors.push({
                sheet: 'Import',
                row: rowNo,
                col: 'ILOSC',
                value: short(r['ILOSC']),
                reason: 'ilosc-calkowita-dodatnia'
            });
            return null;
        }
        if (price === null || price < 0) {
            errors.push({
                sheet: 'Import',
                row: rowNo,
                col: 'CENA_JEDNOSTKOWA',
                value: short(r['CENA_JEDNOSTKOWA']),
                reason: 'cena-nieujemna'
            });
            return null;
        }
        let discount = 0;
        if (r['RABAT'] !== '') {
            const d = parsePlNumber(r['RABAT']);
            if (d === null || d < 0 || d > 100) {
                errors.push({
                    sheet: 'Import',
                    row: rowNo,
                    col: 'RABAT',
                    value: short(r['RABAT']),
                    reason: 'rabat-0-100'
                });
                return null;
            }
            discount = d;
        }
        well.components.push({
            indeks: r['INDEKS_CZESCI'] || '',
            ilosc: qty,
            rabat: discount,
            cenaJednostkowa: price
        });
    }
    const wells = Object.values(wellMap)
        .map((w) => {
            if (w.magazynDennica == null) w.magazynDennica = w.magazyn;
            if (w.magazynNadbudowa == null) w.magazynNadbudowa = w.magazyn;
            w.magazyn = w.magazynNadbudowa;
            return w;
        })
        .sort((a, b) => (a.lp || 0) - (b.lp || 0));
    return {
        module: 'studnie',
        number,
        payload: {
            number,
            status: 'draft',
            transportCost: 0,
            transportSeparate,
            wells,
            clientName: '',
            investName: ''
        },
        rowsCount: rows.length,
        wellsCount: wells.length
    };
}

// Port _detectImportModule (toolbar.js:267-295): TR-* rozstrzyga, potem
// wiekszosc INDEKS_CZESCI z katalogow.
export function detectModule(
    group: OfferGroup,
    sets: { rury: Set<string>; studnie: Set<string> } | null
): 'rury' | 'studnie' | 'unknown' {
    let ruryTR = false;
    let studnieTR = false;
    let ruryVotes = 0;
    let studnieVotes = 0;
    for (const r of group.rows) {
        const idx = String(r['INDEKS_CZESCI'] || '')
            .trim()
            .toUpperCase();
        if (!idx) continue;
        if (idx === 'TR-RURY') {
            ruryTR = true;
            continue;
        }
        if (idx === 'TR-STUDNIE') {
            studnieTR = true;
            continue;
        }
        if (sets) {
            if (sets.rury.has(idx)) ruryVotes++;
            if (sets.studnie.has(idx)) studnieVotes++;
        }
    }
    if (ruryTR !== studnieTR) return ruryTR ? 'rury' : 'studnie';
    if (!sets || (ruryVotes === 0 && studnieVotes === 0) || ruryVotes === studnieVotes)
        return 'unknown';
    return ruryVotes > studnieVotes ? 'rury' : 'studnie';
}

// --- main ---

interface Checkpoint {
    fileHash: string;
    done: string[];
    startedAt: string;
}

async function main(): Promise<number> {
    const args = parseArgs();
    const t0 = Date.now();
    let aborting = false;
    process.on('SIGINT', () => {
        // Nie wolamy process.exit (crash libuv, patrz ExitError) —
        // flaga konczy petle po biezacym POST, kod 130 na koncu.
        if (aborting) return;
        aborting = true;
        console.error('\n[import:offers] SIGINT — koncze biezacy POST i zapisuje checkpoint...');
    });

    const warnings: string[] = [];
    let ok = 0;
    let skipped = 0;
    let errorGroups = 0;
    let batches = 0;
    const done: string[] = [];
    const errorList: RowError[] = [];

    const fail = (code: number, msg: string): never => {
        console.error(`[import:offers] ${msg}`);
        throw new ExitError(code);
    };

    // Pre-flight: istnienie, rozmiar, format.
    let stat: fs.Stats;
    try {
        stat = fs.statSync(args.file);
    } catch {
        fail(2, `Brak pliku: ${args.file}`);
        throw new Error('unreachable');
    }
    if (!stat.isFile()) fail(2, `To nie jest plik: ${args.file}`);
    if (stat.size > MAX_FILE_BYTES)
        fail(2, `Plik ${(stat.size / 1048576).toFixed(0)}MB > limit ${MAX_FILE_BYTES / 1048576}MB`);
    const head = fs.readFileSync(args.file).subarray(0, 4);
    if (args.format === 'xlsx' && !(head[0] === 0x50 && head[1] === 0x4b)) {
        fail(2, 'Magic bytes nie pasuja do XLSX (oczekiwano PK zip)');
    }

    // Checkpoint / resume.
    const ckptPath = args.resumeFrom || `${args.file}.import-checkpoint.json`;
    let ckpt: Checkpoint | null = null;
    if (args.resumeFrom && fs.existsSync(args.resumeFrom)) {
        ckpt = JSON.parse(fs.readFileSync(args.resumeFrom, 'utf8')) as Checkpoint;
    } else if (!args.resumeFrom && fs.existsSync(ckptPath) && !args.dryRun) {
        console.error(
            '[import:offers] Istnieje checkpoint — uzyj --resume-from aby wznowic (checkpoint NIE jest nadpisywany bez flagi)'
        );
        throw new ExitError(2);
    }
    const fileHash = crypto
        .createHash('sha256')
        .update(`${stat.size}:${stat.mtimeMs}:${args.file}`)
        .digest('hex')
        .slice(0, 16);
    const resumedDone = new Set<string>(ckpt && ckpt.fileHash === fileHash ? ckpt.done : []);

    // Parse.
    let parsedRows: Record<string, string>[];
    try {
        if (args.format === 'xlsx') {
            const out = parseXlsxFile(args.file, warnings);
            parsedRows = out.rows;
        } else {
            parsedRows = await parseCsvFile(args.file);
        }
    } catch (e) {
        fail(2, `Parse: ${e instanceof Error ? e.message : String(e)}`);
        throw new Error('unreachable');
    }
    if (parsedRows.some((r) => !r['NUMER_OFERTY'])) {
        warnings.push('Wiersze bez NUMER_OFERTY trafia do grupy BRAK_NUMERU (nie sa pomijane)');
    }

    const api = new Api(args.server);
    let sets: { rury: Set<string>; studnie: Set<string> } | null = null;
    let typeMap = new Map<string, string>();
    let magazynCodes: Record<string, string> = {};
    if (!args.dryRun) {
        try {
            await api.login(args.user, args.password);
        } catch (e) {
            fail(3, `Logowanie: ${e instanceof Error ? e.message : String(e)}`);
        }
        const fetchIds = async (url: string): Promise<Set<string>> => {
            const r = await api.get(url);
            if (r.status !== 200) return new Set();
            const list = (r.json as { data?: { id?: string }[] }).data || [];
            return new Set(
                list
                    .map((p) =>
                        String(p?.id || '')
                            .trim()
                            .toUpperCase()
                    )
                    .filter(Boolean)
            );
        };
        const [rury, studnie] = await Promise.all([
            fetchIds('/api/products'),
            fetchIds('/api/products-studnie')
        ]);
        if (rury.size || studnie.size) sets = { rury, studnie };
        try {
            const r = await api.get('/api/products-studnie');
            const list =
                (r.json as { data?: { id?: string; componentType?: string }[] }).data || [];
            typeMap = new Map(list.map((p) => [String(p.id || ''), String(p.componentType || '')]));
        } catch {
            typeMap = new Map();
        }
        try {
            // Slownik kodow MAGAZYN (magazynCodes.js:get, fallback DEFAULTS).
            const r = await api.get('/api/settings/magazyn-codes');
            if (r.status === 200 && r.json && typeof r.json === 'object') {
                const j = r.json as Record<string, unknown>;
                for (const k of Object.keys(MAGAZYN_DEFAULTS)) {
                    if (typeof j[k] === 'string' && (j[k] as string).trim() !== '') {
                        magazynCodes[k] = (j[k] as string).trim().toUpperCase();
                    }
                }
            }
        } catch {
            magazynCodes = {};
        }
    }

    const groups = groupRowsIntoOffers(parsedRows);
    const totalRows = parsedRows.length;

    for (const group of groups) {
        if (aborting) break;
        if (group.number === 'BRAK_NUMERU') {
            errorGroups++;
            for (let i = 0; i < group.rows.length; i++) {
                errorList.push({
                    sheet: 'Import',
                    row: i + 2,
                    col: 'NUMER_OFERTY',
                    value: '',
                    reason: 'brak-numeru-oferty'
                });
            }
            if (args.onError === 'abort') break;
            continue;
        }
        if (resumedDone.has(group.number)) {
            skipped++;
            done.push(group.number);
            continue;
        }
        if (group.rows.length > MAX_ROWS_OFFER) {
            errorGroups++;
            errorList.push({
                sheet: 'Import',
                row: 2,
                col: 'NUMER_OFERTY',
                value: short(group.number),
                reason: `oferta>${MAX_ROWS_OFFER}-wierszy-podziel`
            });
            if (args.onError === 'abort') break;
            continue;
        }
        const module = detectModule(group, sets);
        if (module === 'unknown') {
            errorGroups++;
            errorList.push({
                sheet: 'Import',
                row: 2,
                col: 'INDEKS_CZESCI',
                value: short(group.rows[0]?.['INDEKS_CZESCI']),
                reason: 'nie-rozpoznano-modulu (brak TR-* i glosow katalogu)'
            });
            if (args.onError === 'abort') break;
            continue;
        }
        const groupErrors: RowError[] = [];
        const built =
            module === 'rury'
                ? buildRuryPayload(group.number, group.rows, groupErrors)
                : buildStudniePayload(group.number, group.rows, typeMap, magazynCodes, groupErrors);
        if (!built) {
            errorGroups++;
            errorList.push(...groupErrors);
            if (args.onError === 'abort') break;
            continue;
        }
        if (args.dryRun) {
            ok++;
            done.push(group.number);
            continue;
        }

        // Konflikt numeru: search q=number, dokladne dopasowanie.
        const endpoint = module === 'rury' ? '/api/offers-rury' : '/api/offers-rury/studnie';
        const idemBase = module === 'rury' ? IDEM_ENDPOINT_RURY : IDEM_ENDPOINT_STUDNIE;
        let payload = built.payload;
        let action = 'create';
        try {
            const s = await api.get(`/api/offers/search?q=${encodeURIComponent(group.number)}`);
            // Search zwraca {data:[...]} (nie {items}); items jako fallback.
            const sj = s.json as {
                data?: { offer_number?: string; number?: string; id?: string }[];
                items?: { offer_number?: string; number?: string; id?: string }[];
            };
            const items = sj?.data || sj?.items || [];
            const existing = items.find(
                (o) => o.offer_number === group.number || o.number === group.number
            );
            if (existing) {
                if (args.conflict === 'skip') {
                    skipped++;
                    done.push(group.number);
                    continue;
                }
                if (args.conflict === 'overwrite' && existing.id) {
                    action = 'overwrite';
                    payload = { ...payload, id: existing.id };
                } else {
                    action = 'clone';
                    let n = 2;
                    let cand = `${group.number}-${n}`;
                    for (;;) {
                        const c = await api.get(`/api/offers/search?q=${encodeURIComponent(cand)}`);
                        const cj = c.json as {
                            data?: { offer_number?: string; number?: string }[];
                            items?: { offer_number?: string; number?: string }[];
                        };
                        const citems = cj?.data || cj?.items || [];
                        if (!citems.some((o) => o.offer_number === cand || o.number === cand))
                            break;
                        n++;
                        cand = `${group.number}-${n}`;
                        if (n > 99) throw new Error('Brak wolnego numeru klona (2-99 zajete)');
                    }
                    if (module === 'rury') {
                        payload = { ...payload, offer_number: cand, number: cand };
                    } else {
                        payload = { ...payload, number: cand };
                    }
                }
            }
        } catch (e) {
            if (e instanceof Error && /wolnego numeru/.test(e.message)) {
                errorGroups++;
                errorList.push({
                    sheet: 'Import',
                    row: 2,
                    col: 'NUMER_OFERTY',
                    value: short(group.number),
                    reason: 'klon-brak-wolnego-numeru'
                });
                if (args.onError === 'abort') break;
                continue;
            }
            // Search padl — sprobuj POST, serwer i tak zwroci 409 przy duplikacie.
        }

        const idemKey = `cli-${stablePayloadHash({ e: idemBase, u: args.userId, a: action, p: payload }).slice(0, 32)}`;
        batches++;
        try {
            const r = await api.post(endpoint, { data: [payload] }, idemKey);
            if (r.status === 409) {
                const code = (r.json as { code?: string })?.code;
                if (code === 'DUPLICATE_NUMBER' && args.conflict === 'skip') {
                    skipped++;
                    done.push(group.number);
                    continue;
                }
                throw new Error(`409 ${code || ''} — ${JSON.stringify(r.json).slice(0, 200)}`);
            }
            if (r.status >= 400) {
                throw new Error(`${r.status} — ${JSON.stringify(r.json).slice(0, 300)}`);
            }
            // Audyt best-effort (I-012): blad tylko do warnings, nigdy fail importu.
            const entityId = (r.json as { results?: { id?: string }[] })?.results?.[0]?.id || '';
            const auditOk = await api.audit(
                module === 'rury' ? 'offer' : 'studnia_oferta',
                entityId,
                {
                    number: group.number,
                    action,
                    rowsCount: built.rowsCount,
                    wellsCount: built.wellsCount,
                    source: 'cli'
                }
            );
            if (!auditOk) warnings.push(`Audyt nie zapisany dla ${group.number} (best-effort)`);
            ok++;
            done.push(group.number);
        } catch (e) {
            errorGroups++;
            errorList.push({
                sheet: 'Import',
                row: 2,
                col: 'NUMER_OFERTY',
                value: short(group.number),
                reason: `post: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200)
            });
            if (args.onError === 'abort') break;
        }
    }

    const report = {
        file: args.file,
        fileHash,
        totalRows,
        offers: groups.length,
        ok,
        skipped,
        errors: errorGroups,
        errorList: errorList.slice(0, 1000),
        errorListTruncated: errorList.length > 1000,
        batches,
        warnings,
        dryRun: args.dryRun,
        durationMs: Date.now() - t0
    };
    fs.writeFileSync(args.reportOut, JSON.stringify(report, null, 2), 'utf8');
    if (!args.dryRun) {
        fs.writeFileSync(
            ckptPath,
            JSON.stringify({ fileHash, done, startedAt: new Date().toISOString() }, null, 2),
            'utf8'
        );
    }

    console.log(
        `[import:offers] ofert=${groups.length} wierszy=${totalRows} ok=${ok} pominieto=${skipped} bledy=${errorGroups} batchy=${batches} czas=${report.durationMs}ms`
    );
    for (const w of warnings.slice(0, 10)) console.log(`[import:offers] warn: ${w}`);
    for (const e of errorList.slice(0, 20)) {
        console.log(
            `[import:offers] blad: ${e.sheet}!R${e.row}C(${e.col})=${e.value} :: ${e.reason}`
        );
    }
    if (errorList.length > 20)
        console.log(
            `[import:offers] ... +${errorList.length - 20} (pelna lista w ${args.reportOut})`
        );

    if (aborting) return 130;
    if (errorGroups > 0) return 1;
    return 0;
}

// Guard: import w testach nie uruchamia CLI (require.main check).
if (require.main === module) {
    main().then(
        (code) => {
            process.exitCode = code;
        },
        (err: unknown) => {
            if (err instanceof ExitError) {
                process.exitCode = err.code;
            } else {
                console.error('[import:offers] Blad:', err instanceof Error ? err.message : err);
                process.exitCode = 3;
            }
        }
    );
}
