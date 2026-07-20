[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetProductsStudnieGroupByPayload

# Type Alias: GetProductsStudnieGroupByPayload\<T\>

> **GetProductsStudnieGroupByPayload**\<`T`\> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`ProductsStudnieGroupByOutputType`](ProductsStudnieGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof ProductsStudnieGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], ProductsStudnieGroupByOutputType[P]> : GetScalarType<T[P], ProductsStudnieGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:31605

## Type Parameters

### T

`T` *extends* [`ProductsStudnieGroupByArgs`](ProductsStudnieGroupByArgs.md)
