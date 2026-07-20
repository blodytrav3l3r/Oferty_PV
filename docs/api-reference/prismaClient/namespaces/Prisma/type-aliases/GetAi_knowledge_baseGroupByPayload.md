[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAi\_knowledge\_baseGroupByPayload

# Type Alias: GetAi\_knowledge\_baseGroupByPayload\<T\>

> **GetAi\_knowledge\_baseGroupByPayload**\<`T`\> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`Ai_knowledge_baseGroupByOutputType`](Ai_knowledge_baseGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof Ai_knowledge_baseGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], Ai_knowledge_baseGroupByOutputType[P]> : GetScalarType<T[P], Ai_knowledge_baseGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:9031

## Type Parameters

### T

`T` *extends* [`ai_knowledge_baseGroupByArgs`](ai_knowledge_baseGroupByArgs.md)
