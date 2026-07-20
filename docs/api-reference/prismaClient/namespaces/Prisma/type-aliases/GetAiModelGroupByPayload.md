[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAiModelGroupByPayload

# Type Alias: GetAiModelGroupByPayload\<T\>

> **GetAiModelGroupByPayload**\<`T`> \> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`AiModelGroupByOutputType`](AiModelGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof AiModelGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], AiModelGroupByOutputType[P]> : GetScalarType<T[P], AiModelGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:34212

## Type Parameters

### T

`T` _extends_ [`AiModelGroupByArgs`](AiModelGroupByArgs.md)
