[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAi\_telemetry\_versionsAggregateType

# Type Alias: GetAi\_telemetry\_versionsAggregateType\<T\>

> **GetAi\_telemetry\_versionsAggregateType**\<`T`\> = \{ \[P in keyof T & keyof AggregateAi\_telemetry\_versions\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateAi\_telemetry\_versions\[P\]\> : GetScalarType\<T\[P\], AggregateAi\_telemetry\_versions\[P\]\> \}

Defined in: generated/prisma/index.d.ts:7846

## Type Parameters

### T

`T` *extends* [`Ai_telemetry_versionsAggregateArgs`](Ai_telemetry_versionsAggregateArgs.md)
