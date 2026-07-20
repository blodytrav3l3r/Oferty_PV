[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAi\_telemetry\_eventsGroupByPayload

# Type Alias: GetAi\_telemetry\_eventsGroupByPayload\<T\>

> **GetAi\_telemetry\_eventsGroupByPayload**\<`T`\> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`Ai_telemetry_eventsGroupByOutputType`](Ai_telemetry_eventsGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof Ai_telemetry_eventsGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], Ai_telemetry_eventsGroupByOutputType[P]> : GetScalarType<T[P], Ai_telemetry_eventsGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:5699

## Type Parameters

### T

`T` *extends* [`ai_telemetry_eventsGroupByArgs`](ai_telemetry_eventsGroupByArgs.md)
