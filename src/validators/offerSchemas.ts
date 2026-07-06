/**
 * Schematy walidacji Zod dla ofert
 *
 * Definiuje struktury danych dla ofert rur i studni używane
 * przy tworzeniu, aktualizacji i walidacji danych wejściowych API.
 *
 * @module validators/offerSchemas
 * @example
 * ```ts
 * // Walidacja pojedynczej oferty
 * const result = offerCreateSchema.safeParse({
 *   clientId: 'client-123',
 *   items: [{ productId: 'prod-1', quantity: 5, price: 100 }]
 * });
 *
 * if (result.success) {
 *   console.log('Dane poprawne:', result.data);
 * } else {
 *   console.error('Błędy walidacji:', result.error.issues);
 * }
 * ```
 */

import { z } from 'zod';

// =============================================================================
// PRODUKTY (CENNIKI) — PATCH
// =============================================================================

/**
 * Schemat dla PATCH /api/products/:id (rury)
 * Wszystkie pola opcjonalne — tylko te, które są dozwolone do aktualizacji.
 */
export const productPatchSchema = z
    .object({
        name: z.string().optional(),
        category: z.string().optional(),
        price: z.number().optional(),
        transport: z.number().nullable().optional(),
        weight: z.number().nullable().optional(),
        area: z.number().nullable().optional()
    })
    .passthrough();

/**
 * Schemat dla PATCH /api/products-studnie/:id (studnie)
 * Wszystkie pola opcjonalne — pokrywa wszystkie dozwolone pola w productsStudnieV2.
 */
export const productStudniePatchSchema = z
    .object({
        name: z.string().optional(),
        category: z.string().optional(),
        componentType: z.string().optional(),
        dn: z.union([z.string(), z.number()]).nullable().optional(),
        height: z.number().nullable().optional(),
        weight: z.number().nullable().optional(),
        price: z.number().optional(),
        area: z.number().nullable().optional(),
        areaExt: z.number().nullable().optional(),
        transport: z.number().nullable().optional(),
        magazynWL: z.boolean().optional(),
        magazynKLB: z.boolean().optional(),
        formaStandardowa: z.boolean().optional(),
        formaStandardowaKLB: z.boolean().optional(),
        active: z.boolean().optional(),
        zapasDol: z.number().nullable().optional(),
        zapasGora: z.number().nullable().optional(),
        zapasDolMin: z.number().nullable().optional(),
        zapasGoraMin: z.number().nullable().optional(),
        spocznikH: z.string().nullable().optional(),
        hMin1: z.number().nullable().optional(),
        hMax1: z.number().nullable().optional(),
        cena1: z.number().nullable().optional(),
        hMin2: z.number().nullable().optional(),
        hMax2: z.number().nullable().optional(),
        cena2: z.number().nullable().optional(),
        hMin3: z.number().nullable().optional(),
        hMax3: z.number().nullable().optional(),
        cena3: z.number().nullable().optional(),
        doplataPEHD: z.number().nullable().optional(),
        doplataZelbet: z.number().nullable().optional(),
        doplataDrabNierdzewna: z.number().nullable().optional(),
        malowanieWewnetrzne: z.number().nullable().optional(),
        malowanieZewnetrzne: z.number().nullable().optional()
    })
    .passthrough();

/**
 * Schemat dla PUT /api/preco-pricing — pełny zapis (data: obiekt lub tablica)
 */
export const precoPricingUpdateSchema = z.object({
    data: z.union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown()))])
});

/**
 * Schemat dla PATCH /api/preco-pricing — częściowa aktualizacja (data: obiekt)
 */
export const precoPricingPatchSchema = z.object({
    data: z.record(z.string(), z.unknown())
});

// =============================================================================
// OFERTY RURY
// =============================================================================

/**
 * Pozycja w ofercie rur
 */
export const offerItemSchema = z
    .object({
        id: z.string().optional(),
        productId: z.string().min(1, 'ID produktu jest wymagane'),
        quantity: z.number().positive('Ilość musi być dodatnia'),
        discount: z.number().min(0).max(100).optional(),
        price: z.number().nonnegative('Cena nie może być ujemna').optional()
    })
    .passthrough();

/**
 * Schemat tworzenia oferty rur
 */
export const offerCreateSchema = z
    .object({
        id: z.string().optional(),
        clientId: z.string().min(1, 'ID klienta jest wymagane'),
        state: z.enum(['draft', 'final']).default('draft'),
        status: z.enum(['active', 'draft']).optional(),
        transportCost: z.number().min(0).default(0),
        items: z.array(offerItemSchema),
        data: z.record(z.string(), z.unknown()).optional()
    })
    .passthrough();

/**
 * Schemat aktualizacji oferty rur (wszystkie pola opcjonalne)
 */
export const offerUpdateSchema = offerCreateSchema.partial();

/**
 * Schemat dla zbiorczego zapisu ofert rur
 * Przy aktualizacji clientId nie jest wymagany (wymagany tylko przy tworzeniu)
 */
export const offersBatchSchema = z.object({
    data: z.array(offerCreateSchema.partial({ clientId: true }))
});

// =============================================================================
// OFERTY STUDNIE
// =============================================================================

/**
 * Komponent studni w ofercie
 */
export const wellComponentSchema = z
    .object({
        id: z.string().optional(),
        name: z.string().optional(),
        typ: z.string().optional(),
        componentType: z.string().optional(),
        layer: z.string().optional(),
        dn: z.number().positive().optional(),
        height: z.number().nonnegative().optional(),
        wysokoscUzytkowa: z.number().nonnegative().optional(),
        waga: z.number().nonnegative().optional(),
        pojemnosc: z.number().nonnegative().optional(),
        iloscStopni: z.number().int().nonnegative().optional(),
        position: z.number().int().nonnegative().optional(),
        quantity: z.number().int().positive().default(1),
        price: z.number().nonnegative().optional(),
        isOverwritten: z.boolean().optional(),
        overwrittenCost: z.number().nonnegative().optional()
    })
    .passthrough();

/**
 * Przejście szczelne w studni
 */
export const passageConfigSchema = z
    .object({
        kat: z.union([z.string(), z.number()]).optional(),
        angle: z.union([z.string(), z.number()]).optional(),
        DN: z.union([z.string(), z.number()]).optional(),
        dnPrzejscia: z.union([z.string(), z.number()]).optional(),
        typRury: z.string().optional(),
        typPrzejscia: z.string().optional(),
        heightFromBottom: z.number().nonnegative().optional(),
        zapasDol: z.number().nonnegative().optional(),
        zapasGora: z.number().nonnegative().optional(),
        zapasDolMin: z.number().nonnegative().optional(),
        zapasGoraMin: z.number().nonnegative().optional()
    })
    .passthrough();

/**
 * Dane pojedynczej studni w ofercie
 */
export const wellDataSchema = z
    .object({
        id: z.string().optional(),
        dn: z.union([z.number(), z.string().min(1, 'Średnica DN jest wymagana')]).optional(),
        type: z.string().optional(),
        totalPrice: z.number().nonnegative().optional(),
        price: z.number().nonnegative().optional(),
        zwienczenie: z.string().optional(),
        components: z.array(wellComponentSchema).optional(),
        passages: z.array(passageConfigSchema).optional(),
        height: z.number().positive('Wysokość studni jest wymagana').optional(),
        depth: z.number().nonnegative().optional()
    })
    .passthrough();

/**
 * Schemat tworzenia oferty studni
 */
export const offerStudnieCreateSchema = z
    .object({
        id: z.string().optional(),
        clientId: z.string().min(1, 'ID klienta jest wymagane'),
        state: z.enum(['draft', 'final']).default('draft'),
        status: z.enum(['active', 'draft']).optional(),
        transportCost: z.number().min(0).default(0),
        wells: z.array(wellDataSchema),
        totalPrice: z.number().nonnegative().optional(),
        data: z.record(z.string(), z.unknown()).optional()
    })
    .passthrough();

/**
 * Schemat aktualizacji oferty studni
 */
export const offerStudnieUpdateSchema = offerStudnieCreateSchema.partial();

/**
 * Schemat dla zbiorczego zapisu ofert studni
 * Przy aktualizacji clientId i wells nie są wymagane (wymagane tylko przy tworzeniu)
 */
export const offersStudnieBatchSchema = z.object({
    data: z.array(offerStudnieCreateSchema.partial({ clientId: true, wells: true }))
});

// =============================================================================
// TYPY TYPEScript (inferencja z Zod)
// =============================================================================

export type OfferItemInput = z.infer<typeof offerItemSchema>;
export type OfferCreateInput = z.infer<typeof offerCreateSchema>;
export type OfferUpdateInput = z.infer<typeof offerUpdateSchema>;
export type OffersBatchInput = z.infer<typeof offersBatchSchema>;

export type WellComponentInput = z.infer<typeof wellComponentSchema>;
export type PassageConfigInput = z.infer<typeof passageConfigSchema>;
export type WellDataInput = z.infer<typeof wellDataSchema>;
export type OfferStudnieCreateInput = z.infer<typeof offerStudnieCreateSchema>;
export type OfferStudnieUpdateInput = z.infer<typeof offerStudnieUpdateSchema>;
export type OffersStudnieBatchInput = z.infer<typeof offersStudnieBatchSchema>;

// =============================================================================
// KLIENCI
// =============================================================================

/**
 * Walidacja polskiego NIP (10 cyfr + checksum)
 */
function isValidNip(nip: string): boolean {
    const cleaned = nip.replace(/[\s-]/g, '');
    if (!/^\d{10}$/.test(cleaned)) return false;
    const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cleaned[i], 10) * weights[i];
    }
    const checksum = sum % 11;
    return checksum === parseInt(cleaned[9], 10);
}

/**
 * Schemat pojedynczego klienta
 */
export const clientSchema = z.object({
    id: z.string().optional(),
    name: z
        .string()
        .min(1, 'Nazwa klienta jest wymagana')
        .max(200, 'Nazwa klienta nie może przekraczać 200 znaków'),
    nip: z
        .string()
        .optional()
        .refine((val) => !val || val.trim() === '' || isValidNip(val), {
            message: 'Nieprawidłowy format NIP (wymagane 10 cyfr z poprawną sumą kontrolną)'
        }),
    address: z.string().max(500, 'Adres nie może przekraczać 500 znaków').optional(),
    contact: z.string().max(200, 'Kontakt nie może przekraczać 200 znaków').optional(),
    phone: z
        .string()
        .optional()
        .refine((val) => !val || val.trim() === '' || /^[\d+\-() ]{7,20}$/.test(val), {
            message: 'Nieprawidłowy format telefonu (7-20 znaków: cyfry, +, -, (), spacje)'
        }),
    email: z.string().email('Nieprawidłowy format email').optional().or(z.literal(''))
});

/**
 * Schemat synchronizacji klientów (batch)
 */
export const clientsBatchSchema = z.object({
    data: z.array(clientSchema)
});

export type ClientInput = z.infer<typeof clientSchema>;
export type ClientsBatchInput = z.infer<typeof clientsBatchSchema>;

// =============================================================================
// PRODUKTY / CENNIKI
// =============================================================================

/**
 * Schemat walidacji danych cennika (tablica pozycji)
 */
export const pricelistDataSchema = z.object({
    data: z.array(z.record(z.string(), z.unknown()))
});

export type PricelistDataInput = z.infer<typeof pricelistDataSchema>;

// =============================================================================
// USTAWIENIA
// =============================================================================

/**
 * Schemat litera roku
 */
export const yearLetterSchema = z.object({
    letter: z.string().length(1, 'Litera musi być pojedynczym znakiem')
});

export type YearLetterInput = z.infer<typeof yearLetterSchema>;

// =============================================================================
// TELEMETRIA
// =============================================================================

/**
 * Schemat nadpisania konfiguracji telemetrycznej
 */
export const telemetryOverrideSchema = z.object({
    originalConfig: z.record(z.string(), z.unknown()),
    finalConfig: z.record(z.string(), z.unknown()),
    overrideReason: z.string().min(1, 'Powód nadpisania jest wymagany')
});

export type TelemetryOverrideInput = z.infer<typeof telemetryOverrideSchema>;

// =============================================================================
// UŻYTKOWNICY
// =============================================================================

/**
 * Schemat aktualizacji użytkownika (admin)
 */
export const userUpdateSchema = z.object({
    username: z.string().min(3).optional(),
    password: z.string().min(4).optional(),
    role: z.enum(['admin', 'user', 'pro']).optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    symbol: z.string().optional(),
    subUsers: z.array(z.string()).optional(),
    orderStartNumber: z.number().int().min(1).optional(),
    productionOrderStartNumber: z.number().int().min(1).optional()
});

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

// =============================================================================
// ZAMÓWIENIA
// =============================================================================

/**
 * Schemat pozycji zamówienia produkcyjnego (batch)
 */
export const productionOrderItemSchema = z
    .object({
        id: z.string().optional(),
        userId: z.string().optional(),
        orderId: z.string().optional(),
        wellId: z.string().optional(),
        elementIndex: z.number().int().optional()
    })
    .passthrough();

/**
 * Schemat batcha zamówień produkcyjnych (PUT /)
 */
export const productionOrdersBatchSchema = z.object({
    data: z.array(productionOrderItemSchema)
});

/**
 * Schemat tworzenia zamówienia produkcyjnego (POST /)
 */
export const productionOrderCreateSchema = z
    .object({
        wellId: z.string().min(1, 'ID studni jest wymagane'),
        orderId: z.string().optional(),
        userId: z.string().optional(),
        elementIndex: z.number().int().optional()
    })
    .passthrough();

/**
 * Schemat pozycji zamówienia studni (batch)
 */
export const studnieOrderItemSchema = z
    .object({
        id: z.string().optional(),
        offerStudnieId: z.string().optional(),
        status: z.string().optional()
    })
    .passthrough();

/**
 * Schemat batcha zamówień studni (PUT /)
 */
export const studnieOrdersBatchSchema = z.object({
    data: z.array(studnieOrderItemSchema)
});

/**
 * Schemat aktualizacji zamówienia studni (PATCH /:id)
 */
export const studnieOrderUpdateSchema = z
    .object({
        status: z.string().optional(),
        userId: z.string().optional(),
        data: z.record(z.string(), z.unknown()).optional()
    })
    .passthrough();

export type ProductionOrderItemInput = z.infer<typeof productionOrderItemSchema>;
export type ProductionOrdersBatchInput = z.infer<typeof productionOrdersBatchSchema>;
export type ProductionOrderCreateInput = z.infer<typeof productionOrderCreateSchema>;
export type StudnieOrderItemInput = z.infer<typeof studnieOrderItemSchema>;
export type StudnieOrdersBatchInput = z.infer<typeof studnieOrdersBatchSchema>;
export type StudnieOrderUpdateInput = z.infer<typeof studnieOrderUpdateSchema>;

/**
 * Schemat pozycji zamówienia rur (batch)
 */
export const ruryOrderItemSchema = z
    .object({
        id: z.string().optional(),
        offerId: z.string().optional(),
        status: z.string().optional()
    })
    .passthrough();

/**
 * Schemat batcha zamówień rur (PUT /)
 */
export const ruryOrdersBatchSchema = z.object({
    data: z.array(ruryOrderItemSchema)
});

/**
 * Schemat aktualizacji zamówienia rur (PATCH /:id)
 */
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

/**
 * Helpery walidacji "nullish" — akceptują null, '' (pusty string) i NaN
 * jako "brak wartości" (zamieniane na undefined przed właściwą walidacją).
 *
 * Używane w schemacie eksportu oferty z zamówienia, gdzie itemy
 * z in-memory state (`orderCurrentItems`) mogą mieć explicit null/''
 * w polach opcjonalnych (bo nigdy nie były wypełnione w formularzu).
 */
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

/**
 * Schemat pozycji oferty wysyłanej do eksportu PDF/DOCX
 * z bieżącego stanu edycji zamówienia (krok 5).
 *
 * Pola wymagane: productId, name, unitPrice, quantity.
 * Pola opcjonalne akceptują null/'' jako "brak wartości"
 * (dzięki helperom nullish*). Generator PDF/DOCX ma fallbacki
 * dla brakujących danych (np. category='Inne', weight=0).
 */
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

/**
 * Schemat body dla POST /api/orders-rury/:id/export-offer-pdf|docx
 * Wymaga co najmniej jednej pozycji w items.
 */
export const ruryOfferExportSchema = z.object({
    items: z.array(ruryOfferExportItemSchema).min(1, 'Wymagana co najmniej jedna pozycja w items'),
    clientName: z.string().optional().default(''),
    clientNip: z.string().optional().default(''),
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

/**
 * Schemat pozycji studni wysyłanej do eksportu PDF/DOCX
 * z bieżącego stanu edycji zamówienia (krok 5).
 *
 * Pola opcjonalne akceptują null/'' jako "brak wartości"
 * (dzięki helperom nullish*). Generator PDF/DOCX ma fallbacki
 * dla brakujących danych (np. zwienczenie='—', height=0).
 */
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

/**
 * Schemat body dla POST /api/orders-studnie/:id/export-offer-pdf|docx
 * Wymaga co najmniej jednej studni w items.
 */
export const studnieOfferExportSchema = z.object({
    items: z
        .array(studnieOfferExportItemSchema)
        .min(1, 'Wymagana co najmniej jedna studnia w items'),
    clientName: z.string().optional().default(''),
    clientNip: z.string().optional().default(''),
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

// =============================================================================
// MARKETPLACE
// =============================================================================

/**
 * Schemat wyszukiwania ofert w marketplace
 */
export const marketplaceSearchSchema = z.object({
    query: z.string().optional(),
    category: z.string().optional(),
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
    limit: z.number().int().min(1).max(100).default(50),
    skip: z.number().int().min(0).default(0)
});

/**
 * Schemat moderacji oferty
 */
export const marketplaceModerateSchema = z.object({
    action: z.enum(['approve', 'reject', 'hide'], 'Nieprawidłowa akcja moderacji'),
    reason: z.string().optional()
});

export type MarketplaceSearchInput = z.infer<typeof marketplaceSearchSchema>;
export type MarketplaceModerateInput = z.infer<typeof marketplaceModerateSchema>;
