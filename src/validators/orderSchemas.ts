/**
 * Schematy walidacji Zod dla zamówień i eksportu ofert z zamówień
 */

import { z } from 'zod';

// =============================================================================
// ZAMÓWIENIA
// =============================================================================

export const productionOrderItemSchema = z
    .object({
        id: z.string().optional(),
        userId: z.string().optional(),
        orderId: z.string().optional(),
        wellId: z.string().optional(),
        elementIndex: z.number().int().optional(),
        elementKey: z.string().optional()
    })
    .passthrough();

export const productionOrdersBatchSchema = z.object({
    data: z.array(productionOrderItemSchema)
});

export const productionOrderCreateSchema = z
    .object({
        wellId: z.string().min(1, 'ID studni jest wymagane'),
        orderId: z.string().optional(),
        userId: z.string().optional(),
        elementIndex: z.number().int().optional(),
        elementKey: z.string().optional()
    })
    .passthrough();

export const studnieOrderItemSchema = z
    .object({
        id: z.string().optional(),
        offerStudnieId: z.string().optional(),
        status: z.string().optional()
    })
    .passthrough();

export const studnieOrdersBatchSchema = z.object({
    data: z.array(studnieOrderItemSchema)
});

export const studnieOrderUpdateSchema = z
    .object({
        status: z.string().optional(),
        userId: z.string().optional(),
        data: z.record(z.string(), z.unknown()).optional()
    })
    .passthrough();

// =============================================================================
// P0.3 — KONTRAKT DTO STUDNI W ZAMÓWIENIU (observe → strict)
// Lustro allowlisty z public/js/studnie/orderDto.js. Etap observe:
// wykrywa nieznane klucze i loguje (non-blocking, request przechodzi).
// Etap enforcement (P1): przejście na .strict() po audycie logów.
// =============================================================================

export const ORDER_CONFIG_ITEM_DTO_FIELDS = [
    'productId',
    'quantity',
    'frozenPrice',
    'frozenPriceBase',
    'frozenName',
    'disablePehd',
    'disablePreco',
    'isPsiaBuda',
    '_elemId'
] as const;

export const ORDER_PRZEJSCIE_DTO_FIELDS = [
    'productId',
    'dn',
    'rzednaWlaczenia',
    'angle',
    'angleExecution',
    'angleGony',
    'flowType',
    'doplata',
    'frozenPrice',
    'frozenPriceBase',
    'frozenName',
    'katWlaczenia'
] as const;

export const ORDER_WELL_DTO_FIELDS = [
    'id',
    'name',
    'numer',
    'dn',
    'rzednaDna',
    'rzednaWlazu',
    'magazyn',
    'usytuowanie',
    'psiaBuda',
    'stycznaNadbudowa1200',
    'stycznaVariant',
    'zakonczenie',
    'zakonczenieByDn',
    'redukcjaDN1000',
    'redukcjaTargetDN',
    'redukcjaKinety',
    'wkladkaDennica',
    'wkladkaNadbudowa',
    'wkladkaZwienczenie',
    'wkladkaOsadnikPreco',
    'wkladkaOsadnikH',
    'kineta',
    'spocznik',
    'spocznikH',
    'dennicaMaterial',
    'material',
    'nadbudowa',
    'klasaBetonu',
    'klasaNosnosci_korpus',
    'klasaNosnosci_zwienczenie',
    'stopnie',
    'doplata',
    'malowanieW',
    'malowanieWewCena',
    'malowanieZ',
    'malowanieZewCena',
    'powlokaNameW',
    'powlokaNameZ',
    'agresjaChemiczna',
    'agresjaMrozowa',
    'precoFullHeight',
    'pehdDiscount',
    'autoSelect',
    'autoLocked',
    'configSource',
    'config',
    'przejscia'
] as const;

/** Klucze runtime/cache, które DTO ma odcinać (oczekiwane jako nieobecne). */
export const ORDER_WELL_RUNTIME_FIELDS = [
    '_lastAutoConfig',
    '_lastAutoTelemetryId',
    '_aiRankInfo',
    '_lastSolveInputHash',
    '__resCache',
    '_psiaBudaBackup',
    'configErrors',
    'configStatus',
    'wellHeight',
    'type',
    'warehouse'
] as const;

function unknownKeysOf(
    obj: unknown,
    known: readonly string[],
    cap: string[],
    capSize: number
): void {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    for (const k of Object.keys(obj as Record<string, unknown>)) {
        if (!(known as readonly string[]).includes(k) && !cap.includes(k)) {
            if (cap.length < capSize) cap.push(k);
        }
    }
}

export interface StudnieOrderDtoObservation {
    wellsChecked: number;
    unknownWellKeys: string[];
    unknownConfigKeys: string[];
    unknownPrzejscieKeys: string[];
    runtimeLeaked: string[];
}

/**
 * P0.3 observe: skanuje zamówienie pod kątem kluczy spoza kontraktu DTO.
 * Nigdy nie rzuca, nigdy nie blokuje requestu — tylko obserwacja.
 */
export function observeStudnieOrderDto(order: unknown): StudnieOrderDtoObservation {
    const result: StudnieOrderDtoObservation = {
        wellsChecked: 0,
        unknownWellKeys: [],
        unknownConfigKeys: [],
        unknownPrzejscieKeys: [],
        runtimeLeaked: []
    };
    try {
        const o = order as { wells?: unknown } | null;
        const wells = o && Array.isArray(o.wells) ? o.wells : [];
        result.wellsChecked = wells.length;
        for (const w of wells) {
            unknownKeysOf(w, ORDER_WELL_DTO_FIELDS, result.unknownWellKeys, 20);
            const well = w as {
                config?: unknown;
                przejscia?: unknown;
            } | null;
            if (well && typeof well === 'object') {
                if (Array.isArray(well.config)) {
                    for (const item of well.config) {
                        unknownKeysOf(
                            item,
                            ORDER_CONFIG_ITEM_DTO_FIELDS,
                            result.unknownConfigKeys,
                            20
                        );
                    }
                }
                if (Array.isArray(well.przejscia)) {
                    for (const pr of well.przejscia) {
                        unknownKeysOf(
                            pr,
                            ORDER_PRZEJSCIE_DTO_FIELDS,
                            result.unknownPrzejscieKeys,
                            20
                        );
                    }
                }
            }
            // wyciek runtime: klucze z denylist obecne w payloadzie
            if (w && typeof w === 'object' && !Array.isArray(w)) {
                for (const k of ORDER_WELL_RUNTIME_FIELDS) {
                    if (
                        (w as Record<string, unknown>)[k] !== undefined &&
                        !result.runtimeLeaked.includes(k)
                    ) {
                        if (result.runtimeLeaked.length < 20) result.runtimeLeaked.push(k);
                    }
                }
            }
        }
    } catch {
        // obserwacja pasywna
    }
    return result;
}

export type ProductionOrderItemInput = z.infer<typeof productionOrderItemSchema>;
export type ProductionOrdersBatchInput = z.infer<typeof productionOrdersBatchSchema>;
export type ProductionOrderCreateInput = z.infer<typeof productionOrderCreateSchema>;
export type StudnieOrderItemInput = z.infer<typeof studnieOrderItemSchema>;
export type StudnieOrdersBatchInput = z.infer<typeof studnieOrdersBatchSchema>;
export type StudnieOrderUpdateInput = z.infer<typeof studnieOrderUpdateSchema>;

export const ruryOrderItemSchema = z
    .object({
        id: z.string().optional(),
        offerId: z.string().optional(),
        status: z.string().optional()
    })
    .passthrough();

export const ruryOrdersBatchSchema = z.object({
    data: z.array(ruryOrderItemSchema)
});

export const ruryOrderUpdateSchema = z
    .object({
        status: z.string().optional(),
        userId: z.string().optional(),
        data: z.record(z.string(), z.unknown()).optional()
    })
    .passthrough();

export type RuryOrderItemInput = z.infer<typeof ruryOrderItemSchema>;
export type RuryOrdersBatchInput = z.infer<typeof ruryOrdersBatchSchema>;
export type RuryOrderUpdateInput = z.infer<typeof ruryOrderUpdateSchema>;

// =============================================================================
// EKSPORT ZAMÓWIENIA JAKO OFERTY (PDF/DOCX)
// =============================================================================

const nullishString = z.preprocess(
    (v) => (v === null || v === '' ? undefined : v),
    z.string().optional()
);
const nullishNumber = z.preprocess(
    (v) => (v === null || v === '' || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
    z.number().nonnegative().optional()
);
const nullishBoolean = z.preprocess(
    (v) => (v === null || v === '' ? undefined : v),
    z.boolean().optional()
);
const nullishEnum = <T extends readonly [string, ...string[]]>(values: T) =>
    z.preprocess((v) => (v === null || v === '' ? undefined : v), z.enum(values).optional());

export const ruryOfferExportItemSchema = z.object({
    productId: z.string().min(1, 'ID produktu jest wymagane'),
    name: z.string().min(1, 'Nazwa produktu jest wymagana'),
    unitPrice: z.preprocess(
        (v) => (v === null || v === '' ? 0 : v),
        z.number().nonnegative('Cena jednostkowa nie może być ujemna')
    ),
    quantity: z.preprocess(
        (v) => (v === null || v === '' ? 0 : v),
        z.number().positive('Ilość musi być dodatnia')
    ),
    discount: nullishNumber,
    weight: nullishNumber,
    category: nullishString,
    pehdType: nullishEnum(['PEHD-3MM', 'PEHD-4MM']),
    pehdCostPerUnit: nullishNumber,
    autoAdded: nullishBoolean,
    uid: nullishString
});

export const ruryOfferExportSchema = z.object({
    items: z.array(ruryOfferExportItemSchema).min(1, 'Wymagana co najmniej jedna pozycja w items'),
    clientName: z.string().optional().default(''),
    clientNip: z.string().optional().default(''),
    clientNumber: z.string().optional().default(''),
    clientAddress: z.string().optional().default(''),
    clientContact: z.string().optional().default(''),
    investName: z.string().optional().default(''),
    investAddress: z.string().optional().default(''),
    investContractor: z.string().optional().default(''),
    notes: z.string().optional().default(''),
    paymentTerms: z.string().optional().default(''),
    validity: z.string().optional().default(''),
    validityDays: z.number().int().min(1).max(365).optional().default(30),
    date: z.string().optional(),
    transportKm: z.number().nonnegative().optional().default(0),
    transportRate: z.number().nonnegative().optional().default(0),
    orderNumber: z.string().optional(),
    offerNumber: z.string().optional()
});

export type RuryOfferExportItemInput = z.infer<typeof ruryOfferExportItemSchema>;
export type RuryOfferExportInput = z.infer<typeof ruryOfferExportSchema>;

// =============================================================================
// STUDNIE — EKSPORT ZAMÓWIENIA JAKO OFERTY (PDF/DOCX)
// =============================================================================

export const studnieOfferExportItemSchema = z.object({
    productId: nullishString,
    productName: z.string().min(1, 'Nazwa studni jest wymagana'),
    quantity: z.preprocess(
        (v) => (v === null || v === '' ? 1 : v),
        z.number().positive('Ilość musi być dodatnia')
    ),
    discount: nullishNumber,
    price: z.preprocess(
        (v) => (v === null || v === '' ? 0 : v),
        z.number().nonnegative('Cena nie może być ujemna')
    ),
    DN: nullishString,
    height: nullishNumber,
    zwienczenie: nullishString,
    transportCost: nullishNumber,
    dodatkowe_info: nullishString
});

export const studnieOfferExportSchema = z.object({
    items: z
        .array(studnieOfferExportItemSchema)
        .min(1, 'Wymagana co najmniej jedna studnia w items'),
    clientName: z.string().optional().default(''),
    clientNip: z.string().optional().default(''),
    clientNumber: z.string().optional().default(''),
    clientAddress: z.string().optional().default(''),
    clientContact: z.string().optional().default(''),
    investName: z.string().optional().default(''),
    investAddress: z.string().optional().default(''),
    notes: z.string().optional().default(''),
    paymentTerms: z.string().optional().default(''),
    validity: z.string().optional().default(''),
    validityDays: z.number().int().min(1).max(365).optional().default(30),
    date: z.string().optional(),
    transportKm: z.number().nonnegative().optional().default(0),
    transportRate: z.number().nonnegative().optional().default(0),
    orderNumber: z.string().optional(),
    offerNumber: z.string().optional()
});

export type StudnieOfferExportItemInput = z.infer<typeof studnieOfferExportItemSchema>;
export type StudnieOfferExportInput = z.infer<typeof studnieOfferExportSchema>;
