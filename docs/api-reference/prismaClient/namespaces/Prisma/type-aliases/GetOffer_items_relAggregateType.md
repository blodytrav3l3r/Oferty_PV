[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetOffer\_items\_relAggregateType

# Type Alias: GetOffer\_items\_relAggregateType\<T\>

> **GetOffer\_items\_relAggregateType**\<`T`> \> = \{ \[P in keyof T & keyof AggregateOffer\_items\_rel\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateOffer\_items\_rel\[P\]\> : GetScalarType\<T\[P\], AggregateOffer\_items\_rel\[P\]\> \}

Defined in: generated/prisma/index.d.ts:14575

## Type Parameters

### T

`T` _extends_ [`Offer_items_relAggregateArgs`](Offer_items_relAggregateArgs.md)
