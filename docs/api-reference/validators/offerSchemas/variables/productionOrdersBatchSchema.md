[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/offerSchemas](../README.md) / productionOrdersBatchSchema

# Variable: productionOrdersBatchSchema

> `const` **productionOrdersBatchSchema**: `ZodObject`\<\{ `data`: `ZodArray`\<`ZodObject`\<\{ `elementIndex`: `ZodOptional`\<`ZodNumber`\>; `id`: `ZodOptional`\<`ZodString`\>; `orderId`: `ZodOptional`\<`ZodString`\>; `userId`: `ZodOptional`\<`ZodString`\>; `wellId`: `ZodOptional`\<`ZodString`\>; \}, `$loose`\>\>; \}, `$strip`\>

Defined in: [src/validators/offerSchemas.ts:397](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/validators/offerSchemas.ts#L397)

Schemat batcha zamówień produkcyjnych (PUT /)
