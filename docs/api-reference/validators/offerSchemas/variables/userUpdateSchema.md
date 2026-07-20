[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/offerSchemas](../README.md) / userUpdateSchema

# Variable: userUpdateSchema

> `const` **userUpdateSchema**: `ZodObject`\<\{ `email`: `ZodUnion`\<\[`ZodOptional`\<`ZodString`>\>, `ZodLiteral`\<`""`>\>\]\>; `firstName`: `ZodOptional`\<`ZodString`>\>; `lastName`: `ZodOptional`\<`ZodString`>\>; `orderStartNumber`: `ZodOptional`\<`ZodNumber`>\>; `password`: `ZodOptional`\<`ZodString`>\>; `phone`: `ZodOptional`\<`ZodString`>\>; `productionOrderStartNumber`: `ZodOptional`\<`ZodNumber`>\>; `role`: `ZodOptional`\<`ZodEnum`\<\{ `admin`: `"admin"`; `pro`: `"pro"`; `user`: `"user"`; \}\>\>; `subUsers`: `ZodOptional`\<`ZodArray`\<`ZodString`>>\>\>; `symbol`: `ZodOptional`\<`ZodString`>\>; `username`: `ZodOptional`\<`ZodString`>\>; \}, `$strip`>\>

Defined in: [src/validators/offerSchemas.ts:361](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/validators/offerSchemas.ts#L361)

Schemat aktualizacji użytkownika (admin)
