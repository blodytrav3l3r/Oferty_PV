[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAudit\_logsGroupByPayload

# Type Alias: GetAudit\_logsGroupByPayload\<T\>

> **GetAudit\_logsGroupByPayload**\<`T`> \> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`Audit_logsGroupByOutputType`](Audit_logsGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof Audit_logsGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], Audit_logsGroupByOutputType[P]> : GetScalarType<T[P], Audit_logsGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:12483

## Type Parameters

### T

`T` _extends_ [`audit_logsGroupByArgs`](audit_logsGroupByArgs.md)
