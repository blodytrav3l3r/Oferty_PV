/**
 * Schematy walidacji Zod dla produktów i cenników
 */

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
// PRODUKTY / CENNIKI
// =============================================================================

export const pricelistDataSchema = z.object({
    data: z.array(z.record(z.string(), z.unknown()))
});

export type PricelistDataInput = z.infer<typeof pricelistDataSchema>;
