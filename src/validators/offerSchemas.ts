/**
 * Schematy walidacji Zod dla ofert
 */

import { z } from 'zod';

// =============================================================================
// OFERTY RURY
// =============================================================================

/**
 * Pozycja w ofercie rur
 */
export const offerItemSchema = z.object({
    id: z.string().optional(),
    productId: z.string().min(1, 'ID produktu jest wymagane'),
    quantity: z.number().positive('Ilość musi być dodatnia'),
    discount: z.number().min(0).max(100).optional(),
    price: z.number().nonnegative('Cena nie może być ujemna').optional()
});

/**
 * Schemat tworzenia oferty rur
 */
export const offerCreateSchema = z.object({
    id: z.string().optional(),
    clientId: z.string().min(1, 'ID klienta jest wymagane'),
    state: z.enum(['draft', 'final']).default('draft'),
    status: z.enum(['active', 'draft']).optional(),
    transportCost: z.number().min(0).default(0),
    items: z.array(offerItemSchema),
    data: z.record(z.string(), z.unknown()).optional()
});

/**
 * Schemat aktualizacji oferty rur (wszystkie pola opcjonalne)
 */
export const offerUpdateSchema = offerCreateSchema.partial();

/**
 * Schemat dla zbiorczego zapisu ofert rur
 */
export const offersBatchSchema = z.object({
    data: z.array(offerCreateSchema)
});

// =============================================================================
// OFERTY STUDNIE
// =============================================================================

/**
 * Komponent studni w ofercie
 */
export const wellComponentSchema = z.object({
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
});

/**
 * Przejście szczelne w studni
 */
export const passageConfigSchema = z.object({
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
});

/**
 * Dane pojedynczej studni w ofercie
 */
export const wellDataSchema = z.object({
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
});

/**
 * Schemat tworzenia oferty studni
 */
export const offerStudnieCreateSchema = z.object({
    id: z.string().optional(),
    clientId: z.string().min(1, 'ID klienta jest wymagane'),
    state: z.enum(['draft', 'final']).default('draft'),
    status: z.enum(['active', 'draft']).optional(),
    transportCost: z.number().min(0).default(0),
    wells: z.array(wellDataSchema),
    totalPrice: z.number().nonnegative().optional(),
    data: z.record(z.string(), z.unknown()).optional()
});

/**
 * Schemat aktualizacji oferty studni
 */
export const offerStudnieUpdateSchema = offerStudnieCreateSchema.partial();

/**
 * Schemat dla zbiorczego zapisu ofert studni
 */
export const offersStudnieBatchSchema = z.object({
    data: z.array(offerStudnieCreateSchema)
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
 * Schemat pojedynczego klienta
 */
export const clientSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, 'Nazwa klienta jest wymagana'),
    nip: z.string().optional(),
    address: z.string().optional(),
    contact: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email('Nieprawidłowy format email').optional().or(z.literal(''))
});

/**
 * Schemat synchronizacji klientów (batch)
 */
export const clientsBatchSchema = z.object({
    data: z.array(clientSchema).min(1, 'Wymagana co najmniej jeden klient')
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
    data: z.array(z.record(z.string(), z.unknown())).min(1, 'Wymagana co najmniej jedna pozycja cennika')
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
export const productionOrderItemSchema = z.object({
    id: z.string().optional(),
    userId: z.string().optional(),
    orderId: z.string().optional(),
    wellId: z.string().optional(),
    elementIndex: z.number().int().optional()
});

/**
 * Schemat batcha zamówień produkcyjnych (PUT /)
 */
export const productionOrdersBatchSchema = z.object({
    data: z.array(productionOrderItemSchema)
});

/**
 * Schemat tworzenia zamówienia produkcyjnego (POST /)
 */
export const productionOrderCreateSchema = z.object({
    wellId: z.string().min(1, 'ID studni jest wymagane'),
    orderId: z.string().optional(),
    userId: z.string().optional(),
    elementIndex: z.number().int().optional()
});

/**
 * Schemat pozycji zamówienia studni (batch)
 */
export const studnieOrderItemSchema = z.object({
    id: z.string().optional(),
    offerStudnieId: z.string().optional(),
    status: z.string().optional()
});

/**
 * Schemat batcha zamówień studni (PUT /)
 */
export const studnieOrdersBatchSchema = z.object({
    data: z.array(studnieOrderItemSchema)
});

/**
 * Schemat aktualizacji zamówienia studni (PATCH /:id)
 */
export const studnieOrderUpdateSchema = z.object({
    status: z.string().optional(),
    userId: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional()
});

export type ProductionOrderItemInput = z.infer<typeof productionOrderItemSchema>;
export type ProductionOrdersBatchInput = z.infer<typeof productionOrdersBatchSchema>;
export type ProductionOrderCreateInput = z.infer<typeof productionOrderCreateSchema>;
export type StudnieOrderItemInput = z.infer<typeof studnieOrderItemSchema>;
export type StudnieOrdersBatchInput = z.infer<typeof studnieOrdersBatchSchema>;
export type StudnieOrderUpdateInput = z.infer<typeof studnieOrderUpdateSchema>;

// =============================================================================
// AUTOMATYCZNY DOBÓR STUDNI
// =============================================================================

/**
 * Schemat konfiguracji automatycznego doboru studni
 */
export const autoSelectConfigSchema = z.object({
    targetDn: z.string().min(1, 'Średnica DN jest wymagana'),
    targetHeight: z.number().positive('Wysokość musi być dodatnia').optional(),
    hasZewnatrzna: z.boolean().optional(),
    hasZweinczenie: z.boolean().optional(),
    hasZasuw: z.boolean().optional(),
    hasPierscienOdciazajacy: z.boolean().optional()
});

/**
 * Schemat walidacji komponentów studni
 */
export const validateComponentsSchema = z.object({
    components: z.array(z.record(z.string(), z.unknown())).min(1, 'Wymagana tablica komponentów'),
    config: z.record(z.string(), z.unknown()).optional()
});

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

export type AutoSelectConfigInput = z.infer<typeof autoSelectConfigSchema>;
export type ValidateComponentsInput = z.infer<typeof validateComponentsSchema>;
export type MarketplaceSearchInput = z.infer<typeof marketplaceSearchSchema>;
export type MarketplaceModerateInput = z.infer<typeof marketplaceModerateSchema>;
