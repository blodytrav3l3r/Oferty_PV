[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/offerSchemas](../README.md) / paginationQuerySchema

# Variable: paginationQuerySchema

> `const` **paginationQuerySchema**: `ZodObject`\<\{ `limit`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `order`: `ZodDefault`\<`ZodEnum`\<\{ `asc`: `"asc"`; `desc`: `"desc"`; \}\>\>; `skip`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `sort`: `ZodOptional`\<`ZodEnum`\<\{ `createdAt`: `"createdAt"`; `offer_number`: `"offer_number"`; `updatedAt`: `"updatedAt"`; \}\>\>; \}, `$strip`\>

Defined in: [src/validators/offerSchemas.ts:651](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/validators/offerSchemas.ts#L651)
