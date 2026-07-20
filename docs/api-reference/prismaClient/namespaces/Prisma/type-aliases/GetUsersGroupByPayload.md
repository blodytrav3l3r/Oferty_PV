[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetUsersGroupByPayload

# Type Alias: GetUsersGroupByPayload\<T\>

> **GetUsersGroupByPayload**\<`T`\> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`UsersGroupByOutputType`](UsersGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof UsersGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], UsersGroupByOutputType[P]> : GetScalarType<T[P], UsersGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:37534

## Type Parameters

### T

`T` *extends* [`usersGroupByArgs`](usersGroupByArgs.md)
