[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetProduction\_orders\_relGroupByPayload

# Type Alias: GetProduction\_orders\_relGroupByPayload\<T\>

> **GetProduction\_orders\_relGroupByPayload**\<`T`> \> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`Production_orders_relGroupByOutputType`](Production_orders_relGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof Production_orders_relGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], Production_orders_relGroupByOutputType[P]> : GetScalarType<T[P], Production_orders_relGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:24025

## Type Parameters

### T

`T` _extends_ [`production_orders_relGroupByArgs`](production_orders_relGroupByArgs.md)
