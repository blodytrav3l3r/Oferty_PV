[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetOrders\_studnie\_relAggregateType

# Type Alias: GetOrders\_studnie\_relAggregateType\<T\>

> **GetOrders\_studnie\_relAggregateType**\<`T`\> = \{ \[P in keyof T & keyof AggregateOrders\_studnie\_rel\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateOrders\_studnie\_rel\[P\]\> : GetScalarType\<T\[P\], AggregateOrders\_studnie\_rel\[P\]\> \}

Defined in: generated/prisma/index.d.ts:20918

## Type Parameters

### T

`T` *extends* [`Orders_studnie_relAggregateArgs`](Orders_studnie_relAggregateArgs.md)
