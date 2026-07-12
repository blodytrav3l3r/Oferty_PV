import { z } from 'zod';
import { nullishString, nullishNumber } from './offerSchemas';

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

export type WellComponentInput = z.infer<typeof wellComponentSchema>;
export type PassageConfigInput = z.infer<typeof passageConfigSchema>;
export type WellDataInput = z.infer<typeof wellDataSchema>;
export type OfferStudnieCreateInput = z.infer<typeof offerStudnieCreateSchema>;
export type OfferStudnieUpdateInput = z.infer<typeof offerStudnieUpdateSchema>;
export type OffersStudnieBatchInput = z.infer<typeof offersStudnieBatchSchema>;

export const productionOrderItemSchema = z
    .object({
        id: z.string().optional(),
        userId: z.string().optional(),
        orderId: z.string().optional(),
        wellId: z.string().optional(),
        elementIndex: z.number().int().optional()
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
        elementIndex: z.number().int().optional()
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

export type ProductionOrderItemInput = z.infer<typeof productionOrderItemSchema>;
export type ProductionOrdersBatchInput = z.infer<typeof productionOrdersBatchSchema>;
export type ProductionOrderCreateInput = z.infer<typeof productionOrderCreateSchema>;
export type StudnieOrderItemInput = z.infer<typeof studnieOrderItemSchema>;
export type StudnieOrdersBatchInput = z.infer<typeof studnieOrdersBatchSchema>;
export type StudnieOrderUpdateInput = z.infer<typeof studnieOrderUpdateSchema>;

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
