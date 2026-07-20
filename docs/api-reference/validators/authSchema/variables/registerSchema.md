[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/authSchema](../README.md) / registerSchema

# Variable: registerSchema

> `const` **registerSchema**: `ZodObject`\<\{ `email`: `ZodUnion`\<\[`ZodOptional`\<`ZodString`\>, `ZodLiteral`\<`""`\>\]\>; `firstName`: `ZodOptional`\<`ZodString`\>; `lastName`: `ZodOptional`\<`ZodString`\>; `orderStartNumber`: `ZodOptional`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>\>; `password`: `ZodString`; `phone`: `ZodOptional`\<`ZodString`\>; `productionOrderStartNumber`: `ZodOptional`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>\>; `role`: `ZodOptional`\<`ZodEnum`\<\{ `admin`: `"admin"`; `pro`: `"pro"`; `user`: `"user"`; \}\>\>; `subUsers`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `symbol`: `ZodOptional`\<`ZodString`\>; `username`: `ZodString`; \}, `$strip`\>

Defined in: [src/validators/authSchema.ts:20](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/validators/authSchema.ts#L20)
