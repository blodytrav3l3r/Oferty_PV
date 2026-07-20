[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetOrder\_counters\_ruryAggregateType

# Type Alias: GetOrder\_counters\_ruryAggregateType\<T\>

> **GetOrder\_counters\_ruryAggregateType**\<`T`> \> = \{ \[P in keyof T & keyof AggregateOrder\_counters\_rury\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateOrder\_counters\_rury\[P\]\> : GetScalarType\<T\[P\], AggregateOrder\_counters\_rury\[P\]\> \}

Defined in: generated/prisma/index.d.ts:19929

## Type Parameters

### T

`T` _extends_ [`Order_counters_ruryAggregateArgs`](Order_counters_ruryAggregateArgs.md)
