[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAiRewardLogGroupByPayload

# Type Alias: GetAiRewardLogGroupByPayload\<T\>

> **GetAiRewardLogGroupByPayload**\<`T`\> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`AiRewardLogGroupByOutputType`](AiRewardLogGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof AiRewardLogGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], AiRewardLogGroupByOutputType[P]> : GetScalarType<T[P], AiRewardLogGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:36400

## Type Parameters

### T

`T` *extends* [`aiRewardLogGroupByArgs`](aiRewardLogGroupByArgs.md)
