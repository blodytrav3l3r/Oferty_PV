[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/offerSchemas](../README.md) / clientsBatchSchema

# Variable: clientsBatchSchema

> `const` **clientsBatchSchema**: `ZodObject`\<\{ `data`: `ZodArray`\<`ZodObject`\<\{ `address`: `ZodOptional`\<`ZodString`\>; `clientNumber`: `ZodOptional`\<`ZodString`\>; `contact`: `ZodOptional`\<`ZodString`\>; `email`: `ZodUnion`\<\[`ZodOptional`\<`ZodString`\>, `ZodLiteral`\<`""`\>\]\>; `id`: `ZodOptional`\<`ZodString`\>; `name`: `ZodString`; `nip`: `ZodOptional`\<`ZodString`\>; `phone`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>\>; \}, `$strip`\>

Defined in: [src/validators/offerSchemas.ts:306](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/validators/offerSchemas.ts#L306)

Schemat synchronizacji klientów (batch)
