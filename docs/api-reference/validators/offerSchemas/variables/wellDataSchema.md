[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/offerSchemas](../README.md) / wellDataSchema

# Variable: wellDataSchema

> `const` **wellDataSchema**: `ZodObject`\<\{ `components`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `componentType`: `ZodOptional`\<`ZodString`>\>; `dn`: `ZodOptional`\<`ZodNumber`>\>; `height`: `ZodOptional`\<`ZodNumber`>\>; `id`: `ZodOptional`\<`ZodString`>\>; `iloscStopni`: `ZodOptional`\<`ZodNumber`>\>; `isOverwritten`: `ZodOptional`\<`ZodBoolean`>\>; `layer`: `ZodOptional`\<`ZodString`>\>; `name`: `ZodOptional`\<`ZodString`>\>; `overwrittenCost`: `ZodOptional`\<`ZodNumber`>\>; `pojemnosc`: `ZodOptional`\<`ZodNumber`>\>; `position`: `ZodOptional`\<`ZodNumber`>\>; `price`: `ZodOptional`\<`ZodNumber`>\>; `quantity`: `ZodDefault`\<`ZodNumber`>\>; `typ`: `ZodOptional`\<`ZodString`>\>; `waga`: `ZodOptional`\<`ZodNumber`>\>; `wysokoscUzytkowa`: `ZodOptional`\<`ZodNumber`>\>; \}, `$loose`>>>\>\>\>; `depth`: `ZodOptional`\<`ZodNumber`>\>; `dn`: `ZodOptional`\<`ZodUnion`\<readonly \[`ZodNumber`, `ZodString`\]\>\>; `height`: `ZodOptional`\<`ZodNumber`>\>; `id`: `ZodOptional`\<`ZodString`>\>; `passages`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `angle`: `ZodOptional`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>\>; `DN`: `ZodOptional`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>\>; `dnPrzejscia`: `ZodOptional`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>\>; `heightFromBottom`: `ZodOptional`\<`ZodNumber`>\>; `kat`: `ZodOptional`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>\>; `typPrzejscia`: `ZodOptional`\<`ZodString`>\>; `typRury`: `ZodOptional`\<`ZodString`>\>; `zapasDol`: `ZodOptional`\<`ZodNumber`>\>; `zapasDolMin`: `ZodOptional`\<`ZodNumber`>\>; `zapasGora`: `ZodOptional`\<`ZodNumber`>\>; `zapasGoraMin`: `ZodOptional`\<`ZodNumber`>\>; \}, `$loose`>>>\>\>\>; `price`: `ZodOptional`\<`ZodNumber`>\>; `totalPrice`: `ZodOptional`\<`ZodNumber`>\>; `type`: `ZodOptional`\<`ZodString`>\>; `zwienczenie`: `ZodOptional`\<`ZodString`>\>; \}, `$loose`>\>

Defined in: [src/validators/offerSchemas.ts:197](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/validators/offerSchemas.ts#L197)

Dane pojedynczej studni w ofercie
