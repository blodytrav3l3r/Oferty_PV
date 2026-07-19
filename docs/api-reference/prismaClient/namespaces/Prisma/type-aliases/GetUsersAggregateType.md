[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetUsersAggregateType

# Type Alias: GetUsersAggregateType\<T\>

> **GetUsersAggregateType**\<`T`> \> = \{ \[P in keyof T & keyof AggregateUsers\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateUsers\[P\]\> : GetScalarType\<T\[P\], AggregateUsers\[P\]\> \}

Defined in: generated/prisma/index.d.ts:37487

## Type Parameters

### T

`T` _extends_ [`UsersAggregateArgs`](UsersAggregateArgs.md)
