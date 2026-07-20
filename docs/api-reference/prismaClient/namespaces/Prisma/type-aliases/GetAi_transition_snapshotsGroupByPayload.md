[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAi\_transition\_snapshotsGroupByPayload

# Type Alias: GetAi\_transition\_snapshotsGroupByPayload\<T\>

> **GetAi\_transition\_snapshotsGroupByPayload**\<`T`\> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`Ai_transition_snapshotsGroupByOutputType`](Ai_transition_snapshotsGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof Ai_transition_snapshotsGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], Ai_transition_snapshotsGroupByOutputType[P]> : GetScalarType<T[P], Ai_transition_snapshotsGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:11391

## Type Parameters

### T

`T` *extends* [`ai_transition_snapshotsGroupByArgs`](ai_transition_snapshotsGroupByArgs.md)
