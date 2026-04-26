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
    dn: z.union([z.number(), z.string()]).optional(),
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
