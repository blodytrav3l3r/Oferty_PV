[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/authSchema](../README.md) / registerSchema

# Variable: registerSchema

> `const` **registerSchema**: `ZodObject`\<\{ `email`: `ZodUnion`\<\[`ZodOptional`\<`ZodString`>\>, `ZodLiteral`\<`""`>\>\]\>; `firstName`: `ZodOptional`\<`ZodString`>\>; `lastName`: `ZodOptional`\<`ZodString`>\>; `orderStartNumber`: `ZodOptional`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>\>; `password`: `ZodString`; `phone`: `ZodOptional`\<`ZodString`>\>; `productionOrderStartNumber`: `ZodOptional`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>\>; `role`: `ZodOptional`\<`ZodEnum`\<\{ `admin`: `"admin"`; `pro`: `"pro"`; `user`: `"user"`; \}\>\>; `subUsers`: `ZodOptional`\<`ZodArray`\<`ZodString`>>\>\>; `symbol`: `ZodOptional`\<`ZodString`>\>; `username`: `ZodString`; \}, `$strip`>\>

Defined in: [src/validators/authSchema.ts:20](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/validators/authSchema.ts#L20)
