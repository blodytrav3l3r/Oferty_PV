[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetOffers\_relAggregateType

# Type Alias: GetOffers\_relAggregateType\<T\>

> **GetOffers\_relAggregateType**\<`T`> \> = \{ \[P in keyof T & keyof AggregateOffers\_rel\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateOffers\_rel\[P\]\> : GetScalarType\<T\[P\], AggregateOffers\_rel\[P\]\> \}

Defined in: generated/prisma/index.d.ts:16718

## Type Parameters

### T

`T` _extends_ [`Offers_relAggregateArgs`](Offers_relAggregateArgs.md)
