[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAiFeatureAggregateType

# Type Alias: GetAiFeatureAggregateType\<T\>

> **GetAiFeatureAggregateType**\<`T`\> = \{ \[P in keyof T & keyof AggregateAiFeature\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateAiFeature\[P\]\> : GetScalarType\<T\[P\], AggregateAiFeature\[P\]\> \}

Defined in: generated/prisma/index.d.ts:32975

## Type Parameters

### T

`T` *extends* [`AiFeatureAggregateArgs`](AiFeatureAggregateArgs.md)
