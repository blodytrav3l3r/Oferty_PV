[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAiModelAggregateType

# Type Alias: GetAiModelAggregateType\<T\>

> **GetAiModelAggregateType**\<`T`\> = \{ \[P in keyof T & keyof AggregateAiModel\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateAiModel\[P\]\> : GetScalarType\<T\[P\], AggregateAiModel\[P\]\> \}

Defined in: generated/prisma/index.d.ts:34167

## Type Parameters

### T

`T` *extends* [`AiModelAggregateArgs`](AiModelAggregateArgs.md)
