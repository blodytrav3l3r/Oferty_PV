[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetCategoriesStudnieAggregateType

# Type Alias: GetCategoriesStudnieAggregateType\<T\>

> **GetCategoriesStudnieAggregateType**\<`T`\> = \{ \[P in keyof T & keyof AggregateCategoriesStudnie\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateCategoriesStudnie\[P\]\> : GetScalarType\<T\[P\], AggregateCategoriesStudnie\[P\]\> \}

Defined in: generated/prisma/index.d.ts:30177

## Type Parameters

### T

`T` *extends* [`CategoriesStudnieAggregateArgs`](CategoriesStudnieAggregateArgs.md)
