[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAiFeatureGroupByPayload

# Type Alias: GetAiFeatureGroupByPayload\<T\>

> **GetAiFeatureGroupByPayload**\<`T`\> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`AiFeatureGroupByOutputType`](AiFeatureGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof AiFeatureGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], AiFeatureGroupByOutputType[P]> : GetScalarType<T[P], AiFeatureGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:33030

## Type Parameters

### T

`T` *extends* [`AiFeatureGroupByArgs`](AiFeatureGroupByArgs.md)
