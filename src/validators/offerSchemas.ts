import { z } from 'zod';

// =============================================================================
// PRODUKTY (CENNIKI) — PATCH
// =============================================================================

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

export const precoPricingUpdateSchema = z.object({
    data: z.union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown()))])
});

export const precoPricingPatchSchema = z.object({
    data: z.record(z.string(), z.unknown())
});

// =============================================================================
// KLIENCI
// =============================================================================

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

export const clientsBatchSchema = z.object({
    data: z.array(clientSchema)
});

export type ClientInput = z.infer<typeof clientSchema>;
export type ClientsBatchInput = z.infer<typeof clientsBatchSchema>;

// =============================================================================
// PRODUKTY / CENNIKI
// =============================================================================

export const pricelistDataSchema = z.object({
    data: z.array(z.record(z.string(), z.unknown()))
});

export type PricelistDataInput = z.infer<typeof pricelistDataSchema>;

// =============================================================================
// USTAWIENIA
// =============================================================================

export const yearLetterSchema = z.object({
    letter: z.string().length(1, 'Litera musi być pojedynczym znakiem')
});

export type YearLetterInput = z.infer<typeof yearLetterSchema>;

// =============================================================================
// TELEMETRIA
// =============================================================================

export const telemetryOverrideSchema = z.object({
    originalConfig: z.record(z.string(), z.unknown()),
    finalConfig: z.record(z.string(), z.unknown()),
    overrideReason: z.string().min(1, 'Powód nadpisania jest wymagany')
});

export type TelemetryOverrideInput = z.infer<typeof telemetryOverrideSchema>;

// =============================================================================
// UŻYTKOWNICY
// =============================================================================

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
// MARKETPLACE
// =============================================================================

export const marketplaceSearchSchema = z.object({
    query: z.string().optional(),
    category: z.string().optional(),
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
    limit: z.number().int().min(1).max(100).default(50),
    skip: z.number().int().min(0).default(0)
});

export const marketplaceModerateSchema = z.object({
    action: z.enum(['approve', 'reject', 'hide'], 'Nieprawidłowa akcja moderacji'),
    reason: z.string().optional()
});

export type MarketplaceSearchInput = z.infer<typeof marketplaceSearchSchema>;
export type MarketplaceModerateInput = z.infer<typeof marketplaceModerateSchema>;

// =============================================================================
// PAGINACJA
// =============================================================================

export const paginationQuerySchema = z.object({
    skip: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    sort: z.enum(['createdAt', 'updatedAt', 'offer_number']).optional(),
    order: z.enum(['asc', 'desc']).default('desc')
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// =============================================================================
// WSPÓLNE HELPERY NULLISH
// (używane przez rurySchemas i studnieSchemas)
// =============================================================================

export const nullishString = z.preprocess(
    (v) => (v === null || v === '' ? undefined : v),
    z.string().optional()
);

export const nullishNumber = z.preprocess(
    (v) => (v === null || v === '' || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
    z.number().nonnegative().optional()
);

export const nullishBoolean = z.preprocess(
    (v) => (v === null || v === '' ? undefined : v),
    z.boolean().optional()
);

export const nullishEnum = <T extends readonly [string, ...string[]]>(values: T) =>
    z.preprocess((v) => (v === null || v === '' ? undefined : v), z.enum(values).optional());
