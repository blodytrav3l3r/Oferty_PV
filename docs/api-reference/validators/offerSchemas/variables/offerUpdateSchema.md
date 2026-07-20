[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/offerSchemas](../README.md) / offerUpdateSchema

# Variable: offerUpdateSchema

> `const` **offerUpdateSchema**: `ZodObject`\<\{ `clientId`: `ZodOptional`\<`ZodString`\>; `data`: `ZodOptional`\<`ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>\>; `id`: `ZodOptional`\<`ZodOptional`\<`ZodString`\>\>; `items`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `discount`: `ZodOptional`\<`ZodNumber`\>; `id`: `ZodOptional`\<`ZodString`\>; `price`: `ZodOptional`\<`ZodNumber`\>; `productId`: `ZodString`; `quantity`: `ZodNumber`; \}, `$loose`\>\>\>; `state`: `ZodOptional`\<`ZodDefault`\<`ZodEnum`\<\{ `draft`: `"draft"`; `final`: `"final"`; \}\>\>\>; `status`: `ZodOptional`\<`ZodOptional`\<`ZodEnum`\<\{ `active`: `"active"`; `draft`: `"draft"`; \}\>\>\>; `transportCost`: `ZodOptional`\<`ZodDefault`\<`ZodNumber`\>\>; \}, `$loose`\>

Defined in: [src/validators/offerSchemas.ts:137](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/validators/offerSchemas.ts#L137)

Schemat aktualizacji oferty rur (wszystkie pola opcjonalne)
