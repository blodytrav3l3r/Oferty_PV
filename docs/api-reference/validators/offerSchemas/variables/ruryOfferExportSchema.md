[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/offerSchemas](../README.md) / ruryOfferExportSchema

# Variable: ruryOfferExportSchema

> `const` **ruryOfferExportSchema**: `ZodObject`\<\{ `clientAddress`: `ZodDefault`\<`ZodOptional`\<`ZodString`>>\>\>; `clientContact`: `ZodDefault`\<`ZodOptional`\<`ZodString`>>\>\>; `clientName`: `ZodDefault`\<`ZodOptional`\<`ZodString`>>\>\>; `clientNip`: `ZodDefault`\<`ZodOptional`\<`ZodString`>>\>\>; `date`: `ZodOptional`\<`ZodString`>\>; `investAddress`: `ZodDefault`\<`ZodOptional`\<`ZodString`>>\>\>; `investContractor`: `ZodDefault`\<`ZodOptional`\<`ZodString`>>\>\>; `investName`: `ZodDefault`\<`ZodOptional`\<`ZodString`>>\>\>; `items`: `ZodArray`\<`ZodObject`\<\{ `autoAdded`: `ZodPreprocess`\<`ZodOptional`\<`ZodBoolean`>>\>\>; `category`: `ZodPreprocess`\<`ZodOptional`\<`ZodString`>>\>\>; `discount`: `ZodPreprocess`\<`ZodOptional`\<`ZodNumber`>>\>\>; `name`: `ZodString`; `pehdCostPerUnit`: `ZodPreprocess`\<`ZodOptional`\<`ZodNumber`>>\>\>; `pehdType`: `ZodPreprocess`\<`ZodOptional`\<`ZodEnum`\<\{\[`key`: `string`\]: `string`; \}\>\>\>; `productId`: `ZodString`; `quantity`: `ZodPreprocess`\<`ZodNumber`>\>; `uid`: `ZodPreprocess`\<`ZodOptional`\<`ZodString`>>\>\>; `unitPrice`: `ZodPreprocess`\<`ZodNumber`>\>; `weight`: `ZodPreprocess`\<`ZodOptional`\<`ZodNumber`>>\>\>; \}, `$strip`>>\>\>; `notes`: `ZodDefault`\<`ZodOptional`\<`ZodString`>>\>\>; `offerNumber`: `ZodOptional`\<`ZodString`>\>; `orderNumber`: `ZodOptional`\<`ZodString`>\>; `paymentTerms`: `ZodDefault`\<`ZodOptional`\<`ZodString`>>\>\>; `transportKm`: `ZodDefault`\<`ZodOptional`\<`ZodNumber`>>\>\>; `transportRate`: `ZodDefault`\<`ZodOptional`\<`ZodNumber`>>\>\>; `validity`: `ZodDefault`\<`ZodOptional`\<`ZodString`>>\>\>; `validityDays`: `ZodDefault`\<`ZodOptional`\<`ZodNumber`>>\>\>; \}, `$strip`>\>

Defined in: [src/validators/offerSchemas.ts:538](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/validators/offerSchemas.ts#L538)

Schemat body dla POST /api/orders-rury/:id/export-offer-pdf|docx
Wymaga co najmniej jednej pozycji w items.
