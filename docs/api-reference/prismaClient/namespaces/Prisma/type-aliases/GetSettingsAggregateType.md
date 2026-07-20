[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetSettingsAggregateType

# Type Alias: GetSettingsAggregateType\<T\>

> **GetSettingsAggregateType**\<`T`\> = \{ \[P in keyof T & keyof AggregateSettings\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateSettings\[P\]\> : GetScalarType\<T\[P\], AggregateSettings\[P\]\> \}

Defined in: generated/prisma/index.d.ts:26996

## Type Parameters

### T

`T` *extends* [`SettingsAggregateArgs`](SettingsAggregateArgs.md)
