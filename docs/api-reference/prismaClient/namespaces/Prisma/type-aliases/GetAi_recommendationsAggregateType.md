[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAi\_recommendationsAggregateType

# Type Alias: GetAi\_recommendationsAggregateType\<T\>

> **GetAi\_recommendationsAggregateType**\<`T`\> = \{ \[P in keyof T & keyof AggregateAi\_recommendations\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateAi\_recommendations\[P\]\> : GetScalarType\<T\[P\], AggregateAi\_recommendations\[P\]\> \}

Defined in: generated/prisma/index.d.ts:10156

## Type Parameters

### T

`T` *extends* [`Ai_recommendationsAggregateArgs`](Ai_recommendationsAggregateArgs.md)
