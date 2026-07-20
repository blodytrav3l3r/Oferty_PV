[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAi\_transition\_snapshotsAggregateType

# Type Alias: GetAi\_transition\_snapshotsAggregateType\<T\>

> **GetAi\_transition\_snapshotsAggregateType**\<`T`\> = \{ \[P in keyof T & keyof AggregateAi\_transition\_snapshots\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateAi\_transition\_snapshots\[P\]\> : GetScalarType\<T\[P\], AggregateAi\_transition\_snapshots\[P\]\> \}

Defined in: generated/prisma/index.d.ts:11340

## Type Parameters

### T

`T` *extends* [`Ai_transition_snapshotsAggregateArgs`](Ai_transition_snapshotsAggregateArgs.md)
