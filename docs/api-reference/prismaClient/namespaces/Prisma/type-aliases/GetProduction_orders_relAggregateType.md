[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetProduction\_orders\_relAggregateType

# Type Alias: GetProduction\_orders\_relAggregateType\<T\>

> **GetProduction\_orders\_relAggregateType**\<`T`> \> = \{ \[P in keyof T & keyof AggregateProduction\_orders\_rel\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateProduction\_orders\_rel\[P\]\> : GetScalarType\<T\[P\], AggregateProduction\_orders\_rel\[P\]\> \}

Defined in: generated/prisma/index.d.ts:23983

## Type Parameters

### T

`T` _extends_ [`Production_orders_relAggregateArgs`](Production_orders_relAggregateArgs.md)
