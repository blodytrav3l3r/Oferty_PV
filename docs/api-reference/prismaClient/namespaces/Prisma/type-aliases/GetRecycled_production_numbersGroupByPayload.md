[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetRecycled\_production\_numbersGroupByPayload

# Type Alias: GetRecycled\_production\_numbersGroupByPayload\<T\>

> **GetRecycled\_production\_numbersGroupByPayload**\<`T`\> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`Recycled_production_numbersGroupByOutputType`](Recycled_production_numbersGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof Recycled_production_numbersGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], Recycled_production_numbersGroupByOutputType[P]> : GetScalarType<T[P], Recycled_production_numbersGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:25066

## Type Parameters

### T

`T` *extends* [`recycled_production_numbersGroupByArgs`](recycled_production_numbersGroupByArgs.md)
