[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetOrders\_rury\_relGroupByPayload

# Type Alias: GetOrders\_rury\_relGroupByPayload\<T\>

> **GetOrders\_rury\_relGroupByPayload**\<`T`\> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`Orders_rury_relGroupByOutputType`](Orders_rury_relGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof Orders_rury_relGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], Orders_rury_relGroupByOutputType[P]> : GetScalarType<T[P], Orders_rury_relGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:21959

## Type Parameters

### T

`T` *extends* [`orders_rury_relGroupByArgs`](orders_rury_relGroupByArgs.md)
