[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAi\_recommendationsGroupByPayload

# Type Alias: GetAi\_recommendationsGroupByPayload\<T\>

> **GetAi\_recommendationsGroupByPayload**\<`T`\> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`Ai_recommendationsGroupByOutputType`](Ai_recommendationsGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof Ai_recommendationsGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], Ai_recommendationsGroupByOutputType[P]> : GetScalarType<T[P], Ai_recommendationsGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:10203

## Type Parameters

### T

`T` *extends* [`ai_recommendationsGroupByArgs`](ai_recommendationsGroupByArgs.md)
