[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetProductsStudnieAggregateType

# Type Alias: GetProductsStudnieAggregateType\<T\>

> **GetProductsStudnieAggregateType**\<`T`\> = \{ \[P in keyof T & keyof AggregateProductsStudnie\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateProductsStudnie\[P\]\> : GetScalarType\<T\[P\], AggregateProductsStudnie\[P\]\> \}

Defined in: generated/prisma/index.d.ts:31537

## Type Parameters

### T

`T` *extends* [`ProductsStudnieAggregateArgs`](ProductsStudnieAggregateArgs.md)
