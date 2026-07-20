[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetCategoriesRuryAggregateType

# Type Alias: GetCategoriesRuryAggregateType\<T\>

> **GetCategoriesRuryAggregateType**\<`T`\> = \{ \[P in keyof T & keyof AggregateCategoriesRury\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateCategoriesRury\[P\]\> : GetScalarType\<T\[P\], AggregateCategoriesRury\[P\]\> \}

Defined in: generated/prisma/index.d.ts:27980

## Type Parameters

### T

`T` *extends* [`CategoriesRuryAggregateArgs`](CategoriesRuryAggregateArgs.md)
