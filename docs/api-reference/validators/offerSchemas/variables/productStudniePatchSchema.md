[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/offerSchemas](../README.md) / productStudniePatchSchema

# Variable: productStudniePatchSchema

> `const` **productStudniePatchSchema**: `ZodObject`\<\{ `active`: `ZodOptional`\<`ZodBoolean`>\>; `area`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `areaExt`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `category`: `ZodOptional`\<`ZodString`>\>; `cena1`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `cena2`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `cena3`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `componentType`: `ZodOptional`\<`ZodString`>\>; `dn`: `ZodOptional`\<`ZodNullable`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>\>\>; `doplataDrabNierdzewna`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `doplataPEHD`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `doplataZelbet`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `formaStandardowa`: `ZodOptional`\<`ZodBoolean`>\>; `formaStandardowaKLB`: `ZodOptional`\<`ZodBoolean`>\>; `height`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `hMax1`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `hMax2`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `hMax3`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `hMin1`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `hMin2`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `hMin3`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `magazynKLB`: `ZodOptional`\<`ZodBoolean`>\>; `magazynWL`: `ZodOptional`\<`ZodBoolean`>\>; `malowanieWewnetrzne`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `malowanieZewnetrzne`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `name`: `ZodOptional`\<`ZodString`>\>; `price`: `ZodOptional`\<`ZodNumber`>\>; `spocznikH`: `ZodOptional`\<`ZodNullable`\<`ZodString`>>\>\>; `transport`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `weight`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `zapasDol`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `zapasDolMin`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `zapasGora`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; `zapasGoraMin`: `ZodOptional`\<`ZodNullable`\<`ZodNumber`>>\>\>; \}, `$loose`>\>

Defined in: [src/validators/offerSchemas.ts:49](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/validators/offerSchemas.ts#L49)

Schemat dla PATCH /api/products-studnie/:id (studnie)
Wszystkie pola opcjonalne — pokrywa wszystkie dozwolone pola w productsStudnieV2.
