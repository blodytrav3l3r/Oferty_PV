// @ts-nocheck -- vm sandbox, celowy brak typow dla public/vendor
/* =============================================================
   F0 (opcja C): pomiary uzasadniajace limity UI + batch CLI.
   Zero zmian logiki biznesowej. Plik raportuje, nie egzekwuje
   sztywnych progow (progi miekkie, z zapasem x10 od pomiaru).

   Pomiary referencyjne (node 24, SheetJS vendor 0.20.3):
     n=1000  xlsx=0.4MB  write=92ms   read=133ms  heap+11MB
     n=10000 xlsx=4.5MB  write=628ms  read=816ms  heap+59MB
     n=50000 xlsx=23MB   write=3613ms read=4946ms heap+189MB
   Przegladarka jest ~2-3x wolniejsza + presja pamieci taba.
   Wniosek: UI cap 5MB / 5k wierszy; CLI batch 500; XLSX>100k -> CSV.
   Limity BE: largeJson 50mb (mountRoutes.ts:68), smallJson 1mb (:67).
   ============================================================= */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..');

function loadVendorXlsx() {
    const code = fs.readFileSync(path.join(ROOT, 'public', 'vendor', 'xlsx.full.min.js'), 'utf8');
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'xlsx.full.min.js' });
    return sandbox.XLSX;
}

function makeRows(n, cols = 12) {
    const base = {
        NUMER_OFERTY: '',
        NR_STUDNI: '',
        GLEBOKOSC: '3',
        INDEKS_CZESCI: '',
        ILOSC: '2',
        CENA_JEDNOSTKOWA: '1234,50',
        WERSJA: '1',
        RABAT: '10',
        SREDNICA: '1000',
        ZAKONCZENIE: 'X',
        MAGAZYN: 'WL',
        LP: ''
    };
    const keys = Object.keys(base).slice(0, cols);
    const rows = new Array(n);
    for (let i = 0; i < n; i++) {
        const r = {};
        for (const k of keys) r[k] = base[k];
        r.NUMER_OFERTY = 'OF/000' + (i % 50);
        r.INDEKS_CZESCI = 'ABC-' + i;
        r.LP = String(i);
        rows[i] = r;
    }
    return rows;
}

describe('F0: SheetJS roundtrip/time (vendor 0.20.3)', () => {
    let XLSX;
    beforeAll(() => {
        XLSX = loadVendorXlsx();
        expect(XLSX.version).toBe('0.20.3');
    }, 30000);

    test('1k wierszy: roundtrip poprawny, rozmiar < 1MB', () => {
        const rows = makeRows(1000);
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Import');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        expect(buf.length).toBeLessThan(1024 * 1024);

        const t0 = Date.now();
        const wb2 = XLSX.read(buf, { type: 'buffer', cellDates: false, raw: false });
        const back = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], {
            defval: '',
            raw: false
        });
        const ms = Date.now() - t0;

        console.info(`F0 bench: 1k rows xlsx=${buf.length}B readMs=${ms}`);
        expect(back).toHaveLength(1000);
        expect(back[0].NUMER_OFERTY).toBe('OF/0000');
        expect(ms).toBeLessThan(10000);
    }, 60000);

    test('5k wierszy: roundtrip poprawny, rozmiar ~2MB', () => {
        const rows = makeRows(5000);
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Import');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        console.info(`F0 bench: 5k rows xlsx=${buf.length}B`);
        expect(buf.length).toBeLessThan(5 * 1024 * 1024);

        const t0 = Date.now();
        const wb2 = XLSX.read(buf, { type: 'buffer', cellDates: false, raw: false });
        const back = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], {
            defval: '',
            raw: false
        });
        const ms = Date.now() - t0;

        console.info(`F0 bench: 5k rows readMs=${ms}`);
        expect(back).toHaveLength(5000);
        expect(ms).toBeLessThan(30000);
    }, 120000);
});

describe('F0: rozmiar payloadu JSON batch vs limit 50MB', () => {
    test('batch 500 wierszy (1 oferta) << 1MB — bezpieczny na kazdej trasie', () => {
        const rows = makeRows(500);
        const payload = JSON.stringify({ data: [{ clientId: 'c1', items: rows }] });

        console.info(`F0 bench: 500-row batch JSON=${payload.length}B`);
        expect(payload.length).toBeLessThan(1024 * 1024);
    });

    test('50k wierszy jako jeden batch to ~11MB — chunk 500 z powodu tx/409, nie 413', () => {
        const rows = makeRows(50000);
        const payload = JSON.stringify({ data: [{ clientId: 'c1', items: rows }] });

        console.info(`F0 bench: 50k-row batch JSON=${payload.length}B`);
        // Fakt: ~11MB < 50MB largeJson (przechodzi rozmiar), ale jedna
        // transakcja 50k + DUPLICATE_NUMBER=409 fail-calego-batcha wymusza
        // chunkowanie 500 (HOT_TX 30s, blad #1). CLI dzieli zawsze (F1).
        expect(payload.length).toBeGreaterThan(5 * 1024 * 1024);
        const chunk = JSON.stringify({ data: [{ clientId: 'c1', items: rows.slice(0, 500) }] });
        expect(chunk.length).toBeLessThan(1024 * 1024);
    }, 60000);
});
