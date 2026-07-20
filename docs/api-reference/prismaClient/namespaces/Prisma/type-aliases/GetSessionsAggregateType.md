[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetSessionsAggregateType

# Type Alias: GetSessionsAggregateType\<T\>

> **GetSessionsAggregateType**\<`T`\> = \{ \[P in keyof T & keyof AggregateSessions\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateSessions\[P\]\> : GetScalarType\<T\[P\], AggregateSessions\[P\]\> \}

Defined in: generated/prisma/index.d.ts:26031

## Type Parameters

### T

`T` *extends* [`SessionsAggregateArgs`](SessionsAggregateArgs.md)
