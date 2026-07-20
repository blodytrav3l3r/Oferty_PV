[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAi\_config\_historyAggregateType

# Type Alias: GetAi\_config\_historyAggregateType\<T\>

> **GetAi\_config\_historyAggregateType**\<`T`\> = \{ \[P in keyof T & keyof AggregateAi\_config\_history\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateAi\_config\_history\[P\]\> : GetScalarType\<T\[P\], AggregateAi\_config\_history\[P\]\> \}

Defined in: generated/prisma/index.d.ts:6782

## Type Parameters

### T

`T` *extends* [`Ai_config_historyAggregateArgs`](Ai_config_historyAggregateArgs.md)
