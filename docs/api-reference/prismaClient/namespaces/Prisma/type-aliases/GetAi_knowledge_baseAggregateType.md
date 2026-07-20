[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAi\_knowledge\_baseAggregateType

# Type Alias: GetAi\_knowledge\_baseAggregateType\<T\>

> **GetAi\_knowledge\_baseAggregateType**\<`T`\> = \{ \[P in keyof T & keyof AggregateAi\_knowledge\_base\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateAi\_knowledge\_base\[P\]\> : GetScalarType\<T\[P\], AggregateAi\_knowledge\_base\[P\]\> \}

Defined in: generated/prisma/index.d.ts:8980

## Type Parameters

### T

`T` *extends* [`Ai_knowledge_baseAggregateArgs`](Ai_knowledge_baseAggregateArgs.md)
