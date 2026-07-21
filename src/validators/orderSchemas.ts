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
