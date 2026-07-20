[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetProductsRuryAggregateType

# Type Alias: GetProductsRuryAggregateType\<T\>

> **GetProductsRuryAggregateType**\<`T`> \> = \{ \[P in keyof T & keyof AggregateProductsRury\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateProductsRury\[P\]\> : GetScalarType\<T\[P\], AggregateProductsRury\[P\]\> \}

Defined in: generated/prisma/index.d.ts:29085

## Type Parameters

### T

`T` _extends_ [`ProductsRuryAggregateArgs`](ProductsRuryAggregateArgs.md)
