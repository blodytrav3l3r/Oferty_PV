[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/offerSchemas](../README.md) / productPatchSchema

# Variable: productPatchSchema

> `const` **productPatchSchema**: `ZodObject`\<\{ `area`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`\>\>; `category`: `ZodOptional`\<`ZodString`\>; `name`: `ZodOptional`\<`ZodString`\>; `price`: `ZodOptional`\<`ZodNumber`\>; `transport`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`\>\>; `weight`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`\>\>; \}, `$loose`\>

Defined in: [src/validators/offerSchemas.ts:34](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/validators/offerSchemas.ts#L34)

Schemat dla PATCH /api/products/:id (rury)
Wszystkie pola opcjonalne — tylko te, które są dozwolone do aktualizacji.
