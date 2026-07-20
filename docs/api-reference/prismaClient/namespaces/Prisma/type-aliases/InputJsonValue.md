[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / InputJsonValue

# Type Alias: InputJsonValue

> **InputJsonValue** = `string` \| `number` \| `boolean` \| [`InputJsonObject`](InputJsonObject.md) \| [`InputJsonArray`](../interfaces/InputJsonArray.md) \| \{ `toJSON`: `unknown`; \}

Defined in: generated/prisma/runtime/library.d.ts:1873

Matches any valid value that can be used as an input for operations like
create and update as the value of a JSON field. Unlike `JsonValue`, this
type allows read-only arrays and read-only object properties and disallows
`null` at the top level.

`null` cannot be used as the value of a JSON field because its meaning
would be ambiguous. Use `Prisma.JsonNull` to store the JSON null value or
`Prisma.DbNull` to clear the JSON value and set the field to the database
NULL value instead.

## See

https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-by-null-values
