[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/offerSchemas](../README.md) / offerStudnieUpdateSchema

# Variable: offerStudnieUpdateSchema

> `const` **offerStudnieUpdateSchema**: `ZodObject`\<\{ `clientId`: `ZodOptional`\<`ZodString`\>; `data`: `ZodOptional`\<`ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>\>; `id`: `ZodOptional`\<`ZodOptional`\<`ZodString`\>\>; `state`: `ZodOptional`\<`ZodDefault`\<`ZodEnum`\<\{ `draft`: `"draft"`; `final`: `"final"`; \}\>\>\>; `status`: `ZodOptional`\<`ZodOptional`\<`ZodEnum`\<\{ `active`: `"active"`; `draft`: `"draft"`; \}\>\>\>; `totalPrice`: `ZodOptional`\<`ZodOptional`\<`ZodNumber`\>\>; `transportCost`: `ZodOptional`\<`ZodDefault`\<`ZodNumber`\>\>; `wells`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `components`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `componentType`: `ZodOptional`\<...\>; `dn`: `ZodOptional`\<...\>; `height`: `ZodOptional`\<...\>; `id`: `ZodOptional`\<...\>; `iloscStopni`: `ZodOptional`\<...\>; `isOverwritten`: `ZodOptional`\<...\>; `layer`: `ZodOptional`\<...\>; `name`: `ZodOptional`\<...\>; `overwrittenCost`: `ZodOptional`\<...\>; `pojemnosc`: `ZodOptional`\<...\>; `position`: `ZodOptional`\<...\>; `price`: `ZodOptional`\<...\>; `quantity`: `ZodDefault`\<...\>; `typ`: `ZodOptional`\<...\>; `waga`: `ZodOptional`\<...\>; `wysokoscUzytkowa`: `ZodOptional`\<...\>; \}, `$loose`\>\>\>; `depth`: `ZodOptional`\<`ZodNumber`\>; `dn`: `ZodOptional`\<`ZodUnion`\<readonly \[`ZodNumber`, `ZodString`\]\>\>; `height`: `ZodOptional`\<`ZodNumber`\>; `id`: `ZodOptional`\<`ZodString`\>; `passages`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `angle`: `ZodOptional`\<...\>; `DN`: `ZodOptional`\<...\>; `dnPrzejscia`: `ZodOptional`\<...\>; `heightFromBottom`: `ZodOptional`\<...\>; `kat`: `ZodOptional`\<...\>; `typPrzejscia`: `ZodOptional`\<...\>; `typRury`: `ZodOptional`\<...\>; `zapasDol`: `ZodOptional`\<...\>; `zapasDolMin`: `ZodOptional`\<...\>; `zapasGora`: `ZodOptional`\<...\>; `zapasGoraMin`: `ZodOptional`\<...\>; \}, `$loose`\>\>\>; `price`: `ZodOptional`\<`ZodNumber`\>; `totalPrice`: `ZodOptional`\<`ZodNumber`\>; `type`: `ZodOptional`\<`ZodString`\>; `zwienczenie`: `ZodOptional`\<`ZodString`\>; \}, `$loose`\>\>\>; \}, `$loose`\>

Defined in: [src/validators/offerSchemas.ts:231](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/validators/offerSchemas.ts#L231)

Schemat aktualizacji oferty studni
