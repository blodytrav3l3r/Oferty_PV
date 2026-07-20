[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetOrders\_rury\_relAggregateType

# Type Alias: GetOrders\_rury\_relAggregateType\<T\>

> **GetOrders\_rury\_relAggregateType**\<`T`\> = \{ \[P in keyof T & keyof AggregateOrders\_rury\_rel\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateOrders\_rury\_rel\[P\]\> : GetScalarType\<T\[P\], AggregateOrders\_rury\_rel\[P\]\> \}

Defined in: generated/prisma/index.d.ts:21924

## Type Parameters

### T

`T` *extends* [`Orders_rury_relAggregateArgs`](Orders_rury_relAggregateArgs.md)
