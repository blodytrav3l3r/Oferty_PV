/**
 * Schematy walidacji Zod dla snapshotu cenników (price_defaults.json).
 *
 * Kontrakt pól 1:1 z modelami Prisma (schema.prisma). Zod daje wczesną
 * diagnostykę per pole przy restore; Prisma pozostaje twardym guardem
 * runtime. Pola wymagane = pola bez defaulta w modelu.
 */

import { z } from 'zod';

export const productsRuryRowSchema = z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    price: z.number(),
    transport: z.number().nullable().optional(),
    weight: z.number().nullable().optional(),
    area: z.number().nullable().optional()
});

export const productsStudnieRowSchema = z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    componentType: z.string(),
    dn: z.string().nullable().optional(),
    height: z.number().int().nullable().optional(),
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
    zapasDol: z.number().int().nullable().optional(),
    zapasGora: z.number().int().nullable().optional(),
    zapasDolMin: z.number().int().nullable().optional(),
    zapasGoraMin: z.number().int().nullable().optional(),
    spocznikH: z.string().nullable().optional(),
    hMin1: z.number().int().nullable().optional(),
    hMax1: z.number().int().nullable().optional(),
    cena1: z.number().nullable().optional(),
    hMin2: z.number().int().nullable().optional(),
    hMax2: z.number().int().nullable().optional(),
    cena2: z.number().nullable().optional(),
    hMin3: z.number().int().nullable().optional(),
    hMax3: z.number().int().nullable().optional(),
    cena3: z.number().nullable().optional(),
    doplataPEHD: z.number().nullable().optional(),
    doplataZelbet: z.number().nullable().optional(),
    doplataDrabNierdzewna: z.number().nullable().optional(),
    malowanieWewnetrzne: z.number().nullable().optional(),
    malowanieZewnetrzne: z.number().nullable().optional()
});

export const precoKonfigRowSchema = z.object({
    id: z.string(),
    key: z.string(),
    value: z.string()
});

export const precoKinetyRowSchema = z.object({
    id: z.string(),
    order: z.number().int(),
    dn: z.number().int(),
    wellDn: z.number().int(),
    height: z.number().int(),
    cena: z.number()
});

export const precoZakresyRowSchema = z.object({
    id: z.string(),
    order: z.number().int(),
    label: z.string(),
    min: z.number().int(),
    max: z.number().int(),
    grupy: z.string(),
    wellDn: z.number().int()
});

export type ProductsRuryRow = z.infer<typeof productsRuryRowSchema>;
export type ProductsStudnieRow = z.infer<typeof productsStudnieRowSchema>;
export type PrecoKonfigRow = z.infer<typeof precoKonfigRowSchema>;
export type PrecoKinetyRow = z.infer<typeof precoKinetyRowSchema>;
export type PrecoZakresyRow = z.infer<typeof precoZakresyRowSchema>;
