[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetCategoriesStudnieGroupByPayload

# Type Alias: GetCategoriesStudnieGroupByPayload\<T\>

> **GetCategoriesStudnieGroupByPayload**\<`T`> \> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`CategoriesStudnieGroupByOutputType`](CategoriesStudnieGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof CategoriesStudnieGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], CategoriesStudnieGroupByOutputType[P]> : GetScalarType<T[P], CategoriesStudnieGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:30213

## Type Parameters

### T

`T` _extends_ [`CategoriesStudnieGroupByArgs`](CategoriesStudnieGroupByArgs.md)
