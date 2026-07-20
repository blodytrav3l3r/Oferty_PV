[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetProductsRuryGroupByPayload

# Type Alias: GetProductsRuryGroupByPayload\<T\>

> **GetProductsRuryGroupByPayload**\<`T`\> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`ProductsRuryGroupByOutputType`](ProductsRuryGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof ProductsRuryGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], ProductsRuryGroupByOutputType[P]> : GetScalarType<T[P], ProductsRuryGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:29125

## Type Parameters

### T

`T` *extends* [`ProductsRuryGroupByArgs`](ProductsRuryGroupByArgs.md)
