[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/offerSchemas](../README.md) / offersBatchSchema

# Variable: offersBatchSchema

> `const` **offersBatchSchema**: `ZodObject`\<\{ `data`: `ZodArray`\<`ZodObject`\<\{ `clientId`: `ZodOptional`\<`ZodString`>\>; `data`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodUnknown`>>\>\>; `id`: `ZodOptional`\<`ZodString`>\>; `items`: `ZodArray`\<`ZodObject`\<\{ `discount`: `ZodOptional`\<`ZodNumber`>\>; `id`: `ZodOptional`\<`ZodString`>\>; `price`: `ZodOptional`\<`ZodNumber`>\>; `productId`: `ZodString`; `quantity`: `ZodNumber`; \}, `$loose`>>\>\>; `state`: `ZodDefault`\<`ZodEnum`\<\{ `draft`: `"draft"`; `final`: `"final"`; \}\>\>; `status`: `ZodOptional`\<`ZodEnum`\<\{ `active`: `"active"`; `draft`: `"draft"`; \}\>\>; `transportCost`: `ZodDefault`\<`ZodNumber`>\>; \}, `$loose`>>\>\>; \}, `$strip`>\>

Defined in: [src/validators/offerSchemas.ts:143](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/validators/offerSchemas.ts#L143)

Schemat dla zbiorczego zapisu ofert rur
Przy aktualizacji clientId nie jest wymagany (wymagany tylko przy tworzeniu)
