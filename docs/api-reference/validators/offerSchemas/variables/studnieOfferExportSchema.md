[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/offerSchemas](../README.md) / studnieOfferExportSchema

# Variable: studnieOfferExportSchema

> `const` **studnieOfferExportSchema**: `ZodObject`\<\{ `clientAddress`: `ZodDefault`\<`ZodOptional`\<`ZodString`\>\>; `clientContact`: `ZodDefault`\<`ZodOptional`\<`ZodString`\>\>; `clientName`: `ZodDefault`\<`ZodOptional`\<`ZodString`\>\>; `clientNip`: `ZodDefault`\<`ZodOptional`\<`ZodString`\>\>; `date`: `ZodOptional`\<`ZodString`\>; `investAddress`: `ZodDefault`\<`ZodOptional`\<`ZodString`\>\>; `investName`: `ZodDefault`\<`ZodOptional`\<`ZodString`\>\>; `items`: `ZodArray`\<`ZodObject`\<\{ `discount`: `ZodPreprocess`\<`ZodOptional`\<`ZodNumber`\>\>; `DN`: `ZodPreprocess`\<`ZodOptional`\<`ZodString`\>\>; `dodatkowe_info`: `ZodPreprocess`\<`ZodOptional`\<`ZodString`\>\>; `height`: `ZodPreprocess`\<`ZodOptional`\<`ZodNumber`\>\>; `price`: `ZodPreprocess`\<`ZodNumber`\>; `productId`: `ZodPreprocess`\<`ZodOptional`\<`ZodString`\>\>; `productName`: `ZodString`; `quantity`: `ZodPreprocess`\<`ZodNumber`\>; `transportCost`: `ZodPreprocess`\<`ZodOptional`\<`ZodNumber`\>\>; `zwienczenie`: `ZodPreprocess`\<`ZodOptional`\<`ZodString`\>\>; \}, `$strip`\>\>; `notes`: `ZodDefault`\<`ZodOptional`\<`ZodString`\>\>; `offerNumber`: `ZodOptional`\<`ZodString`\>; `orderNumber`: `ZodOptional`\<`ZodString`\>; `paymentTerms`: `ZodDefault`\<`ZodOptional`\<`ZodString`\>\>; `transportKm`: `ZodDefault`\<`ZodOptional`\<`ZodNumber`\>\>; `transportRate`: `ZodDefault`\<`ZodOptional`\<`ZodNumber`\>\>; `validity`: `ZodDefault`\<`ZodOptional`\<`ZodString`\>\>; `validityDays`: `ZodDefault`\<`ZodOptional`\<`ZodNumber`\>\>; \}, `$strip`\>

Defined in: [src/validators/offerSchemas.ts:596](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/validators/offerSchemas.ts#L596)

Schemat body dla POST /api/orders-studnie/:id/export-offer-pdf|docx
Wymaga co najmniej jednej studni w items.
