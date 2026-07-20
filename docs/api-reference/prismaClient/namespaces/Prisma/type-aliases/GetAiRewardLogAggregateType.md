[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAiRewardLogAggregateType

# Type Alias: GetAiRewardLogAggregateType\<T\>

> **GetAiRewardLogAggregateType**\<`T`\> = \{ \[P in keyof T & keyof AggregateAiRewardLog\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateAiRewardLog\[P\]\> : GetScalarType\<T\[P\], AggregateAiRewardLog\[P\]\> \}

Defined in: generated/prisma/index.d.ts:36356

## Type Parameters

### T

`T` *extends* [`AiRewardLogAggregateArgs`](AiRewardLogAggregateArgs.md)
