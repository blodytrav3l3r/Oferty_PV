import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';
import { validateData } from '../validators/authSchema';
import { PRICELIST_WRITE_LIMITER } from '../middleware/rateLimiters';
import { pricelistDataSchema } from '../validators/offerSchemas';
import { requireFinitePrice, InvalidPriceError } from '../validators/finiteNumbers';
import { pricelistLock } from '../middleware/writeLock';
import { buildXlsx } from '../utils/minimalXlsx';
import {
    PricelistVersionError,
    cennikMetaSheet,
    currentPricelistLabel,
    getVersionExportSheets,
    liveSheetsToXlsxSheets,
    projectPrecoNestedToSheets,
    projectVersionToLiveShape,
    requireExportSource,
    requirePricingSource,
    resolveActive,
    resolveActivePricing
} from '../services/pricelistVersionService';
import { versionExportFilename } from '../utils/exportFilenames';
import { getSeedPrecoNested, getSeedStudnie } from '../services/pricelist/seedData';
import {
    findLatestDraft,
    getEditorPricing,
    getPricelistWriteTarget,
    parseIfMatch,
    parseVersionIdHeader,
    saveRowsToDraft
} from '../services/pricelist/writeTarget';
import { pickEditorData } from '../services/pricelist/editorPayload';

const router = express.Router();
const writeLimiter = PRICELIST_WRITE_LIMITER;

const { runWithLock } = pricelistLock;

type StudnieProductRaw = {
    id: string;
    name: string;
    category: string;
    componentType: string;
    dn: string | null;
    height: number | null;
    weight: number | null;
    price: number;
    area: number | null;
    areaExt: number | null;
    transport: number | null;
    magazynWL: boolean;
    magazynKLB: boolean;
    formaStandardowa: boolean;
    formaStandardowaKLB: boolean;
    active: boolean;
    zapasDol: number | null;
    zapasGora: number | null;
    zapasDolMin: number | null;
    zapasGoraMin: number | null;
    spocznikH: string | null;
    hMin1: number | null;
    hMax1: number | null;
    cena1: number | null;
    hMin2: number | null;
    hMax2: number | null;
    cena2: number | null;
    hMin3: number | null;
    hMax3: number | null;
    cena3: number | null;
    doplataPEHD: number | null;
    doplataZelbet: number | null;
    doplataDrabNierdzewna: number | null;
    malowanieWewnetrzne: number | null;
    malowanieZewnetrzne: number | null;
};

interface StudnieProductLegacy {
    id: string;
    name: string;
    category: string;
    componentType: string;
    dn: number | string | null;
    height: number | null;
    weight: number | null;
    price: number;
    area: number | null;
    areaExt: number | null;
    transport: number | null;
    magazynWL: number;
    magazynKLB: number;
    formaStandardowa: number;
    formaStandardowaKLB: number;
    active: number;
    zapasDol: number | null;
    zapasGora: number | null;
    zapasDolMin: number | null;
    zapasGoraMin: number | null;
    spocznikH: string | null;
    hMin1: number | null;
    hMax1: number | null;
    cena1: number | null;
    hMin2: number | null;
    hMax2: number | null;
    cena2: number | null;
    hMin3: number | null;
    hMax3: number | null;
    cena3: number | null;
    doplataPEHD: number | null;
    doplataZelbet: number | null;
    doplataDrabNierdzewna: number | null;
    malowanieWewnetrzne: number | null;
    malowanieZewnetrzne: number | null;
}

function fromLegacy(p: Record<string, unknown>): StudnieProductRaw {
    return {
        id: String(p.id ?? ''),
        name: String(p.name ?? ''),
        category: String(p.category ?? ''),
        componentType: String(p.componentType ?? ''),
        dn: p.dn != null ? String(p.dn) : null,
        height: p.height != null ? Number(p.height) : null,
        weight: p.weight != null ? Number(p.weight) : null,
        // D-FIX-2: brak/cicha koercja ceny na 0 zabroniona.
        price: requireFinitePrice(p.price, 'price'),
        area: p.area != null ? Number(p.area) : null,
        areaExt: p.areaExt != null ? Number(p.areaExt) : null,
        transport: p.transport != null ? Number(p.transport) : null,
        magazynWL: p.magazynWL === 1 || p.magazynWL === true,
        magazynKLB: p.magazynKLB === 1 || p.magazynKLB === true,
        formaStandardowa: p.formaStandardowa === 1 || p.formaStandardowa === true,
        formaStandardowaKLB: p.formaStandardowaKLB === 1 || p.formaStandardowaKLB === true,
        active: p.active === 1 || p.active === true,
        zapasDol: p.zapasDol != null ? Number(p.zapasDol) : null,
        zapasGora: p.zapasGora != null ? Number(p.zapasGora) : null,
        zapasDolMin: p.zapasDolMin != null ? Number(p.zapasDolMin) : null,
        zapasGoraMin: p.zapasGoraMin != null ? Number(p.zapasGoraMin) : null,
        spocznikH: p.spocznikH != null ? String(p.spocznikH) : null,
        hMin1: p.hMin1 != null ? Number(p.hMin1) : null,
        hMax1: p.hMax1 != null ? Number(p.hMax1) : null,
        cena1: p.cena1 != null ? Number(p.cena1) : null,
        hMin2: p.hMin2 != null ? Number(p.hMin2) : null,
        hMax2: p.hMax2 != null ? Number(p.hMax2) : null,
        cena2: p.cena2 != null ? Number(p.cena2) : null,
        hMin3: p.hMin3 != null ? Number(p.hMin3) : null,
        hMax3: p.hMax3 != null ? Number(p.hMax3) : null,
        cena3: p.cena3 != null ? Number(p.cena3) : null,
        doplataPEHD: p.doplataPEHD != null ? Number(p.doplataPEHD) : null,
        doplataZelbet: p.doplataZelbet != null ? Number(p.doplataZelbet) : null,
        doplataDrabNierdzewna:
            p.doplataDrabNierdzewna != null ? Number(p.doplataDrabNierdzewna) : null,
        malowanieWewnetrzne: p.malowanieWewnetrzne != null ? Number(p.malowanieWewnetrzne) : null,
        malowanieZewnetrzne: p.malowanieZewnetrzne != null ? Number(p.malowanieZewnetrzne) : null
    };
}

function toLegacy(p: StudnieProductRaw): StudnieProductLegacy {
    const dnVal: number | string | null =
        p.dn != null ? (isNaN(Number(p.dn)) ? p.dn : Number(p.dn)) : null;
    return {
        id: p.id,
        name: p.name,
        category: p.category,
        componentType: p.componentType,
        dn: dnVal,
        height: p.height,
        weight: p.weight,
        price: p.price,
        area: p.area,
        areaExt: p.areaExt,
        transport: p.transport,
        magazynWL: p.magazynWL ? 1 : 0,
        magazynKLB: p.magazynKLB ? 1 : 0,
        formaStandardowa: p.formaStandardowa ? 1 : 0,
        formaStandardowaKLB: p.formaStandardowaKLB ? 1 : 0,
        active: p.active ? 1 : 0,
        zapasDol: p.zapasDol,
        zapasGora: p.zapasGora,
        zapasDolMin: p.zapasDolMin,
        zapasGoraMin: p.zapasGoraMin,
        spocznikH: p.spocznikH,
        hMin1: p.hMin1,
        hMax1: p.hMax1,
        cena1: p.cena1,
        hMin2: p.hMin2,
        hMax2: p.hMax2,
        cena2: p.cena2,
        hMin3: p.hMin3,
        hMax3: p.hMax3,
        cena3: p.cena3,
        doplataPEHD: p.doplataPEHD,
        doplataZelbet: p.doplataZelbet,
        doplataDrabNierdzewna: p.doplataDrabNierdzewna,
        malowanieWewnetrzne: p.malowanieWewnetrzne,
        malowanieZewnetrzne: p.malowanieZewnetrzne
    };
}

// ──────────────────────────────────────────
// GET / — cennik dla edytora: DRAFT → ACTIVE → seed (brak wersji = fabryka)
// ──────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
    try {
        res.setHeader('X-Pricelist-Write-Target', getPricelistWriteTarget());
        const source = requirePricingSource(req.query.source);
        if (!source) {
            // Brak wersji: edytor startuje z cennika fabrycznego (seed).
            res.json({
                data: pickEditorData(await getEditorPricing('studnie'), () =>
                    (getSeedStudnie() as unknown as StudnieProductRaw[]).map(toLegacy)
                )
            });
            return;
        }
        if (source === 'active') {
            const active = await resolveActivePricing('studnie');
            if (active.fallback) {
                // Etap 1: brak ACTIVE = brak ceny oferty (bez cichego LIVE).
                res.status(409).json({
                    error: 'Brak aktywnego cennika studni — opublikuj wersję',
                    code: 'NO_ACTIVE_VERSION'
                });
                return;
            }
            res.json({ data: active.data });
        }
    } catch (err: unknown) {
        if (err instanceof PricelistVersionError) {
            res.status(err.statusCode).json({ error: err.message, code: err.code });
            return;
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsStudnieV2', 'GET error', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// ──────────────────────────────────────────
// PUT / — bulk save (usuń wszystko + utwórz)
// ──────────────────────────────────────────
router.put(
    '/',
    requireAuth,
    requireAdmin,
    writeLimiter,
    validateData(pricelistDataSchema),
    async (req, res) => {
        try {
            const result = await runWithLock(async () => {
                const arr: Record<string, unknown>[] = req.body.data;
                const mapped = arr.map(fromLegacy);

                const editVersionId = parseVersionIdHeader(req.get('X-Pricelist-Version-Id'));
                if (editVersionId) {
                    const v = await saveRowsToDraft(
                        'studnie',
                        mapped,
                        req.user?.id,
                        parseIfMatch(req.get('If-Match')),
                        editVersionId
                    );
                    return {
                        ok: true,
                        count: arr.length,
                        target: 'version',
                        versionId: v.id,
                        sha256: v.sha256
                    };
                }

                const draft = await saveRowsToDraft(
                    'studnie',
                    mapped,
                    req.user?.id,
                    parseIfMatch(req.get('If-Match'))
                );
                return {
                    ok: true,
                    count: arr.length,
                    target: 'draft',
                    versionId: draft.id
                };
            });
            if (!result.acquired) {
                res.status(429).json({ error: 'Zapis w toku, spróbuj ponownie za chwilę' });
                return;
            }
            res.json(result.value);
        } catch (err: unknown) {
            // D-FIX-2: invalid numeric input to 400 (tx rollback — nic nie zapisane).
            if (err instanceof InvalidPriceError) {
                res.status(400).json({ error: err.message });
                return;
            }
            if (err instanceof PricelistVersionError) {
                res.status(err.statusCode).json({ error: err.message, code: err.code });
                return;
            }
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('ProductsStudnieV2', 'PUT error', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

// ──────────────────────────────────────────
// GET /export.xlsx?source=live|default|active — XLSX z serwera (Etap C),
// wiersze w shape GET (legacy 1/0, dn liczbowe), shape 1:1 z eksportem FE
router.get('/export.xlsx', requireAuth, async (req, res) => {
    try {
        const source = requireExportSource(req.query.source);
        if (source === 'draft') {
            const draft = await findLatestDraft('studnie');
            if (!draft) {
                res.status(409).json({
                    error: 'Brak szkicu cennika studni',
                    code: 'NO_DRAFT_VERSION'
                });
                return;
            }
            const { sheets } = await getVersionExportSheets(draft.id);
            const xlsx = await buildXlsx(liveSheetsToXlsxSheets(sheets, 'Cennik'));
            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="Cennik_Studni_${draft.version}_Draft.xlsx"`
            );
            res.send(xlsx);
            return;
        }
        if (source === 'active') {
            const active = await resolveActive('studnie');
            if (!active) {
                res.status(409).json({
                    error: 'Brak aktywnej wersji cennika studni',
                    code: 'NO_ACTIVE_VERSION'
                });
                return;
            }
            const { sheets } = await getVersionExportSheets(active.id);
            const xlsx = await buildXlsx(liveSheetsToXlsxSheets(sheets, 'Cennik'));
            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="Cennik_Studni_${active.version}_Export.xlsx"`
            );
            res.send(xlsx);
            return;
        }
        // Etap 2: `default` = fabryczny seed (tabele domyslne już nie istnieją).
        const rows = getSeedStudnie() as unknown as StudnieProductRaw[];
        const legacy = rows.map(toLegacy);
        const live = projectVersionToLiveShape('studnie', {
            studnie: legacy as unknown as Array<Record<string, unknown>>
        });
        // Domyślnie eksport studni zawiera tylko elementy studni. PRECO ma
        // osobny plik (`/api/preco-pricing/export.xlsx`); `includePreco=1`
        // zostaje dla zgodności ze starym skoroszytem łączonym.
        const includePreco = String(req.query.includePreco ?? '0') !== '0';
        let merged = live;
        if (includePreco) {
            merged = {
                ...live,
                ...projectPrecoNestedToSheets(getSeedPrecoNested() as Record<string, unknown>)
            };
        }
        const label = await currentPricelistLabel('studnie');
        const xlsx = await buildXlsx([
            ...liveSheetsToXlsxSheets(merged, 'Cennik'),
            cennikMetaSheet('Studnie', label)
        ]);
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${label ? versionExportFilename('studnie', label) : 'Cennik_Studni_Export.xlsx'}"`
        );
        res.send(xlsx);
    } catch (err: unknown) {
        if (err instanceof PricelistVersionError) {
            res.status(err.statusCode).json({ error: err.message, code: err.code });
            return;
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsStudnieV2', 'GET /export.xlsx error', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// ──────────────────────────────────────────
// GET /default — fabryczny cennik studni z data/seed_studnie.json
// ──────────────────────────────────────────
router.get('/default', requireAuth, async (_req, res) => {
    try {
        const products = getSeedStudnie() as unknown as StudnieProductRaw[];
        res.json({ data: products.map(toLegacy) });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsStudnieV2', 'GET /default error', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
