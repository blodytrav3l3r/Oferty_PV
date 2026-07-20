[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetClients\_relAggregateType

# Type Alias: GetClients\_relAggregateType\<T\>

> **GetClients\_relAggregateType**\<`T`> \> = \{ \[P in keyof T & keyof AggregateClients\_rel\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateClients\_rel\[P\]\> : GetScalarType\<T\[P\], AggregateClients\_rel\[P\]\> \}

Defined in: generated/prisma/index.d.ts:13496

## Type Parameters

### T

`T` _extends_ [`Clients_relAggregateArgs`](Clients_relAggregateArgs.md)
