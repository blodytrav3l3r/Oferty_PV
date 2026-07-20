[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetProduction\_order\_countersAggregateType

# Type Alias: GetProduction\_order\_countersAggregateType\<T\>

> **GetProduction\_order\_countersAggregateType**\<`T`\> = \{ \[P in keyof T & keyof AggregateProduction\_order\_counters\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateProduction\_order\_counters\[P\]\> : GetScalarType\<T\[P\], AggregateProduction\_order\_counters\[P\]\> \}

Defined in: generated/prisma/index.d.ts:22946

## Type Parameters

### T

`T` *extends* [`Production_order_countersAggregateArgs`](Production_order_countersAggregateArgs.md)
