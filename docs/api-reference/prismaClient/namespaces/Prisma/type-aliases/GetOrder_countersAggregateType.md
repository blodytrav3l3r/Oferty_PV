[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetOrder\_countersAggregateType

# Type Alias: GetOrder\_countersAggregateType\<T\>

> **GetOrder\_countersAggregateType**\<`T`> \> = \{ \[P in keyof T & keyof AggregateOrder\_counters\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateOrder\_counters\[P\]\> : GetScalarType\<T\[P\], AggregateOrder\_counters\[P\]\> \}

Defined in: generated/prisma/index.d.ts:18924

## Type Parameters

### T

`T` _extends_ [`Order_countersAggregateArgs`](Order_countersAggregateArgs.md)
