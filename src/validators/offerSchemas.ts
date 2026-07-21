/**
 * Schematy walidacji Zod dla ofert
 *
 * Definiuje struktury danych dla ofert rur i studni używane
 * przy tworzeniu, aktualizacji i walidacji danych wejściowych API.
 *
 * @module validators/offerSchemas
 */

import { z } from 'zod';

// Re-export z podzielonych plików dla zachowania zgodności wstecznej
export {
    productPatchSchema,
    productStudniePatchSchema,
    precoPricingUpdateSchema,
    precoPricingPatchSchema,
    pricelistDataSchema
} from './productSchemas';
export type { PricelistDataInput } from './productSchemas';

export {
    productionOrderItemSchema,
    productionOrdersBatchSchema,
    productionOrderCreateSchema,
    studnieOrderItemSchema,
    studnieOrdersBatchSchema,
    studnieOrderUpdateSchema,
    ruryOrderItemSchema,
    ruryOrdersBatchSchema,
    ruryOrderUpdateSchema,
    ruryOfferExportItemSchema,
    ruryOfferExportSchema,
    studnieOfferExportItemSchema,
    studnieOfferExportSchema
} from './orderSchemas';
export type {
    ProductionOrderItemInput,
    ProductionOrdersBatchInput,
    ProductionOrderCreateInput,
    StudnieOrderItemInput,
    StudnieOrdersBatchInput,
    StudnieOrderUpdateInput,
    RuryOrderItemInput,
    RuryOrdersBatchInput,
    RuryOrderUpdateInput,
    RuryOfferExportItemInput,
    RuryOfferExportInput,
    StudnieOfferExportItemInput,
    StudnieOfferExportInput
} from './orderSchemas';

// =============================================================================
// OFERTY RURY
// =============================================================================

export const offerItemSchema = z
    .object({
        id: z.string().optional(),
        productId: z.string().min(1, 'ID produktu jest wymagane'),
        quantity: z.number().positive('Ilość musi być dodatnia'),
        discount: z.number().min(0).max(100).optional(),
        price: z.number().nonnegative('Cena nie może być ujemna').optional()
    })
    .passthrough();

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

export const offerUpdateSchema = offerCreateSchema.partial();

export const offersBatchSchema = z.object({
    data: z.array(offerCreateSchema.partial({ clientId: true }))
});

// =============================================================================
// OFERTY STUDNIE
// =============================================================================

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

export const offerStudnieUpdateSchema = offerStudnieCreateSchema.partial();

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
    clientNumber: z.string().max(50, 'Numer klienta nie może przekraczać 50 znaków').optional(),
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
    originalConfig: z.array(z.record(z.string(), z.unknown())).optional(),
    finalConfig: z.array(z.record(z.string(), z.unknown())).optional(),
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
