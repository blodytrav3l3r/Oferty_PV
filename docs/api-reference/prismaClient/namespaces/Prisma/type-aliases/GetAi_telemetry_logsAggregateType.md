[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAi\_telemetry\_logsAggregateType

# Type Alias: GetAi\_telemetry\_logsAggregateType\<T\>

> **GetAi\_telemetry\_logsAggregateType**\<`T`\> = \{ \[P in keyof T & keyof AggregateAi\_telemetry\_logs\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateAi\_telemetry\_logs\[P\]\> : GetScalarType\<T\[P\], AggregateAi\_telemetry\_logs\[P\]\> \}

Defined in: generated/prisma/index.d.ts:4185

## Type Parameters

### T

`T` *extends* [`Ai_telemetry_logsAggregateArgs`](Ai_telemetry_logsAggregateArgs.md)
