[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetOffers\_relGroupByPayload

# Type Alias: GetOffers\_relGroupByPayload\<T\>

> **GetOffers\_relGroupByPayload**\<`T`> \> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`Offers_relGroupByOutputType`](Offers_relGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof Offers_relGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], Offers_relGroupByOutputType[P]> : GetScalarType<T[P], Offers_relGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:16764

## Type Parameters

### T

`T` _extends_ [`offers_relGroupByArgs`](offers_relGroupByArgs.md)
