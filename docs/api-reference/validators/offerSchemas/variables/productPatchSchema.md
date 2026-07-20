[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/offerSchemas](../README.md) / productPatchSchema

# Variable: productPatchSchema

> `const` **productPatchSchema**: `ZodObject`\<\{ `area`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `category`: `ZodOptional`\<`ZodString`>\>; `name`: `ZodOptional`\<`ZodString`>\>; `price`: `ZodOptional`\<`ZodNumber`>\>; `transport`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `weight`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; \}, `$loose`>\>

Defined in: [src/validators/offerSchemas.ts:34](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/validators/offerSchemas.ts#L34)

Schemat dla PATCH /api/products/:id (rury)
Wszystkie pola opcjonalne — tylko te, które są dozwolone do aktualizacji.
