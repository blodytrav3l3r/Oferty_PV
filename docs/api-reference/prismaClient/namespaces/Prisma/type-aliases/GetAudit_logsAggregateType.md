[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAudit\_logsAggregateType

# Type Alias: GetAudit\_logsAggregateType\<T\>

> **GetAudit\_logsAggregateType**\<`T`> \> = \{ \[P in keyof T & keyof AggregateAudit\_logs\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateAudit\_logs\[P\]\> : GetScalarType\<T\[P\], AggregateAudit\_logs\[P\]\> \}

Defined in: generated/prisma/index.d.ts:12446

## Type Parameters

### T

`T` _extends_ [`Audit_logsAggregateArgs`](Audit_logsAggregateArgs.md)
