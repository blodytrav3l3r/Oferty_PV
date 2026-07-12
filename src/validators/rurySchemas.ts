import { z } from 'zod';
import { nullishString, nullishNumber, nullishBoolean, nullishEnum } from './offerSchemas';

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

export type OfferItemInput = z.infer<typeof offerItemSchema>;
export type OfferCreateInput = z.infer<typeof offerCreateSchema>;
export type OfferUpdateInput = z.infer<typeof offerUpdateSchema>;
export type OffersBatchInput = z.infer<typeof offersBatchSchema>;

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
