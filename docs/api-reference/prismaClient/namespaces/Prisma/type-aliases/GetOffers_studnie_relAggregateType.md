[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetOffers\_studnie\_relAggregateType

# Type Alias: GetOffers\_studnie\_relAggregateType\<T\>

> **GetOffers\_studnie\_relAggregateType**\<`T`\> = \{ \[P in keyof T & keyof AggregateOffers\_studnie\_rel\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateOffers\_studnie\_rel\[P\]\> : GetScalarType\<T\[P\], AggregateOffers\_studnie\_rel\[P\]\> \}

Defined in: generated/prisma/index.d.ts:17849

## Type Parameters

### T

`T` *extends* [`Offers_studnie_relAggregateArgs`](Offers_studnie_relAggregateArgs.md)
