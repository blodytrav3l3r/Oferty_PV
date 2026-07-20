[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/offerSchemas](../README.md) / offerCreateSchema

# Variable: offerCreateSchema

> `const` **offerCreateSchema**: `ZodObject`\<\{ `clientId`: `ZodString`; `data`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>; `id`: `ZodOptional`\<`ZodString`\>; `items`: `ZodArray`\<`ZodObject`\<\{ `discount`: `ZodOptional`\<`ZodNumber`\>; `id`: `ZodOptional`\<`ZodString`\>; `price`: `ZodOptional`\<`ZodNumber`\>; `productId`: `ZodString`; `quantity`: `ZodNumber`; \}, `$loose`\>\>; `state`: `ZodDefault`\<`ZodEnum`\<\{ `draft`: `"draft"`; `final`: `"final"`; \}\>\>; `status`: `ZodOptional`\<`ZodEnum`\<\{ `active`: `"active"`; `draft`: `"draft"`; \}\>\>; `transportCost`: `ZodDefault`\<`ZodNumber`\>; \}, `$loose`\>

Defined in: [src/validators/offerSchemas.ts:122](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/validators/offerSchemas.ts#L122)

Schemat tworzenia oferty rur
