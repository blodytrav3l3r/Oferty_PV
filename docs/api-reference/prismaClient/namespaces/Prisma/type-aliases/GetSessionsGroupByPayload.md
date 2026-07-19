[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetSessionsGroupByPayload

# Type Alias: GetSessionsGroupByPayload\<T\>

> **GetSessionsGroupByPayload**\<`T`> \> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`SessionsGroupByOutputType`](SessionsGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof SessionsGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], SessionsGroupByOutputType[P]> : GetScalarType<T[P], SessionsGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:26067

## Type Parameters

### T

`T` _extends_ [`sessionsGroupByArgs`](sessionsGroupByArgs.md)
