[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetOffers\_studnie\_relGroupByPayload

# Type Alias: GetOffers\_studnie\_relGroupByPayload\<T\>

> **GetOffers\_studnie\_relGroupByPayload**\<`T`> \> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`Offers_studnie_relGroupByOutputType`](Offers_studnie_relGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof Offers_studnie_relGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], Offers_studnie_relGroupByOutputType[P]> : GetScalarType<T[P], Offers_studnie_relGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:17895

## Type Parameters

### T

`T` _extends_ [`offers_studnie_relGroupByArgs`](offers_studnie_relGroupByArgs.md)
