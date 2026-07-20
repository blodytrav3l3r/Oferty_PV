[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetHavingFields

# Type Alias: GetHavingFields\<T\>

> **GetHavingFields**\<`T`\> = `{ [K in keyof T]: Or<Or<Extends<"OR", K>, Extends<"AND", K>>, Extends<"NOT", K>> extends True ? T[K] extends infer TK ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never> : never : {} extends FieldPaths<T[K]> ? never : K }`\[keyof `T`\]

Defined in: generated/prisma/index.d.ts:1000

## Type Parameters

### T

`T`
