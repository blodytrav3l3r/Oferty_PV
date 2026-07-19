[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetRecycled\_production\_numbersAggregateType

# Type Alias: GetRecycled\_production\_numbersAggregateType\<T\>

> **GetRecycled\_production\_numbersAggregateType**\<`T`> \> = \{ \[P in keyof T & keyof AggregateRecycled\_production\_numbers\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateRecycled\_production\_numbers\[P\]\> : GetScalarType\<T\[P\], AggregateRecycled\_production\_numbers\[P\]\> \}

Defined in: generated/prisma/index.d.ts:25030

## Type Parameters

### T

`T` _extends_ [`Recycled_production_numbersAggregateArgs`](Recycled_production_numbersAggregateArgs.md)
