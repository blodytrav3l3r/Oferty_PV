[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetOrders\_studnie\_relGroupByPayload

# Type Alias: GetOrders\_studnie\_relGroupByPayload\<T\>

> **GetOrders\_studnie\_relGroupByPayload**\<`T`> \> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`Orders_studnie_relGroupByOutputType`](Orders_studnie_relGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof Orders_studnie_relGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], Orders_studnie_relGroupByOutputType[P]> : GetScalarType<T[P], Orders_studnie_relGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:20953

## Type Parameters

### T

`T` _extends_ [`orders_studnie_relGroupByArgs`](orders_studnie_relGroupByArgs.md)
