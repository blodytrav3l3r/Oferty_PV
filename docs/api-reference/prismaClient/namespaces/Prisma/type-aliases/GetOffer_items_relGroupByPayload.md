[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetOffer\_items\_relGroupByPayload

# Type Alias: GetOffer\_items\_relGroupByPayload\<T\>

> **GetOffer\_items\_relGroupByPayload**\<`T`> \> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`Offer_items_relGroupByOutputType`](Offer_items_relGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof Offer_items_relGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], Offer_items_relGroupByOutputType[P]> : GetScalarType<T[P], Offer_items_relGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:14614

## Type Parameters

### T

`T` _extends_ [`offer_items_relGroupByArgs`](offer_items_relGroupByArgs.md)
