[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAi\_telemetry\_eventsAggregateType

# Type Alias: GetAi\_telemetry\_eventsAggregateType\<T\>

> **GetAi\_telemetry\_eventsAggregateType**\<`T`\> = \{ \[P in keyof T & keyof AggregateAi\_telemetry\_events\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateAi\_telemetry\_events\[P\]\> : GetScalarType\<T\[P\], AggregateAi\_telemetry\_events\[P\]\> \}

Defined in: generated/prisma/index.d.ts:5653

## Type Parameters

### T

`T` *extends* [`Ai_telemetry_eventsAggregateArgs`](Ai_telemetry_eventsAggregateArgs.md)
