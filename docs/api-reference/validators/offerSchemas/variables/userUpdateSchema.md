[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/offerSchemas](../README.md) / userUpdateSchema

# Variable: userUpdateSchema

> `const` **userUpdateSchema**: `ZodObject`\<\{ `email`: `ZodUnion`\<\[`ZodOptional`\<`ZodString`\>, `ZodLiteral`\<`""`\>\]\>; `firstName`: `ZodOptional`\<`ZodString`\>; `lastName`: `ZodOptional`\<`ZodString`\>; `orderStartNumber`: `ZodOptional`\<`ZodNumber`\>; `password`: `ZodOptional`\<`ZodString`\>; `phone`: `ZodOptional`\<`ZodString`\>; `productionOrderStartNumber`: `ZodOptional`\<`ZodNumber`\>; `role`: `ZodOptional`\<`ZodEnum`\<\{ `admin`: `"admin"`; `pro`: `"pro"`; `user`: `"user"`; \}\>\>; `subUsers`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `symbol`: `ZodOptional`\<`ZodString`\>; `username`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>

Defined in: [src/validators/offerSchemas.ts:361](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/validators/offerSchemas.ts#L361)

Schemat aktualizacji użytkownika (admin)
