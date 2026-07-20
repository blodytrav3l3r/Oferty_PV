[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/offerSchemas](../README.md) / productionOrdersBatchSchema

# Variable: productionOrdersBatchSchema

> `const` **productionOrdersBatchSchema**: `ZodObject`\<\{ `data`: `ZodArray`\<`ZodObject`\<\{ `elementIndex`: `ZodOptional`\<`ZodNumber`>\>; `id`: `ZodOptional`\<`ZodString`>\>; `orderId`: `ZodOptional`\<`ZodString`>\>; `userId`: `ZodOptional`\<`ZodString`>\>; `wellId`: `ZodOptional`\<`ZodString`>\>; \}, `$loose`>>\>\>; \}, `$strip`>\>

Defined in: [src/validators/offerSchemas.ts:397](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/validators/offerSchemas.ts#L397)

Schemat batcha zamówień produkcyjnych (PUT /)
