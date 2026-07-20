[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAiEvaluationGroupByPayload

# Type Alias: GetAiEvaluationGroupByPayload\<T\>

> **GetAiEvaluationGroupByPayload**\<`T`\> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`AiEvaluationGroupByOutputType`](AiEvaluationGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof AiEvaluationGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], AiEvaluationGroupByOutputType[P]> : GetScalarType<T[P], AiEvaluationGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:35307

## Type Parameters

### T

`T` *extends* [`AiEvaluationGroupByArgs`](AiEvaluationGroupByArgs.md)
