[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAi\_telemetry\_logsGroupByPayload

# Type Alias: GetAi\_telemetry\_logsGroupByPayload\<T\>

> **GetAi\_telemetry\_logsGroupByPayload**\<`T`> \> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`Ai_telemetry_logsGroupByOutputType`](Ai_telemetry_logsGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof Ai_telemetry_logsGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], Ai_telemetry_logsGroupByOutputType[P]> : GetScalarType<T[P], Ai_telemetry_logsGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:4278

## Type Parameters

### T

`T` _extends_ [`ai_telemetry_logsGroupByArgs`](ai_telemetry_logsGroupByArgs.md)
