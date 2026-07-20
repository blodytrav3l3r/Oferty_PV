[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetCategoriesRuryGroupByPayload

# Type Alias: GetCategoriesRuryGroupByPayload\<T\>

> **GetCategoriesRuryGroupByPayload**\<`T`\> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`CategoriesRuryGroupByOutputType`](CategoriesRuryGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof CategoriesRuryGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], CategoriesRuryGroupByOutputType[P]> : GetScalarType<T[P], CategoriesRuryGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:28015

## Type Parameters

### T

`T` *extends* [`CategoriesRuryGroupByArgs`](CategoriesRuryGroupByArgs.md)
