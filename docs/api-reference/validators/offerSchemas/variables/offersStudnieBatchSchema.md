[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/offerSchemas](../README.md) / offersStudnieBatchSchema

# Variable: offersStudnieBatchSchema

> `const` **offersStudnieBatchSchema**: `ZodObject`\<\{ `data`: `ZodArray`\<`ZodObject`\<\{ `clientId`: `ZodOptional`\<`ZodString`>\>; `data`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodUnknown`>>\>\>; `id`: `ZodOptional`\<`ZodString`>\>; `state`: `ZodDefault`\<`ZodEnum`\<\{ `draft`: `"draft"`; `final`: `"final"`; \}\>\>; `status`: `ZodOptional`\<`ZodEnum`\<\{ `active`: `"active"`; `draft`: `"draft"`; \}\>\>; `totalPrice`: `ZodOptional`\<`ZodNumber`>\>; `transportCost`: `ZodDefault`\<`ZodNumber`>\>; `wells`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `components`: `ZodOptional`\<`ZodArray`\<...\>\>; `depth`: `ZodOptional`\<`ZodNumber`>\>; `dn`: `ZodOptional`\<`ZodUnion`\<...\>\>; `height`: `ZodOptional`\<`ZodNumber`>\>; `id`: `ZodOptional`\<`ZodString`>\>; `passages`: `ZodOptional`\<`ZodArray`\<...\>\>; `price`: `ZodOptional`\<`ZodNumber`>\>; `totalPrice`: `ZodOptional`\<`ZodNumber`>\>; `type`: `ZodOptional`\<`ZodString`>\>; `zwienczenie`: `ZodOptional`\<`ZodString`>\>; \}, `$loose`>>>\>\>\>; \}, `$loose`>>\>\>; \}, `$strip`>\>

Defined in: [src/validators/offerSchemas.ts:237](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/validators/offerSchemas.ts#L237)

Schemat dla zbiorczego zapisu ofert studni
Przy aktualizacji clientId i wells nie są wymagane (wymagane tylko przy tworzeniu)
