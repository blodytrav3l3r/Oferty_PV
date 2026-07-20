[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAi\_telemetry\_versionsGroupByPayload

# Type Alias: GetAi\_telemetry\_versionsGroupByPayload\<T\>

> **GetAi\_telemetry\_versionsGroupByPayload**\<`T`\> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`Ai_telemetry_versionsGroupByOutputType`](Ai_telemetry_versionsGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof Ai_telemetry_versionsGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], Ai_telemetry_versionsGroupByOutputType[P]> : GetScalarType<T[P], Ai_telemetry_versionsGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:7883

## Type Parameters

### T

`T` *extends* [`ai_telemetry_versionsGroupByArgs`](ai_telemetry_versionsGroupByArgs.md)
