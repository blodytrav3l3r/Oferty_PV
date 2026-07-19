[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / offer\_items\_relUpsertArgs

# Type Alias: offer\_items\_relUpsertArgs\<ExtArgs\>

> **offer\_items\_relUpsertArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:15399

offer_items_rel upsert

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`offer_items_relCreateInput`](offer_items_relCreateInput.md), [`offer_items_relUncheckedCreateInput`](offer_items_relUncheckedCreateInput.md)>\>

Defined in: generated/prisma/index.d.ts:15415

In case the offer_items_rel found by the `where` argument doesn't exist, create a new offer_items_rel with this data.

---

### omit?

> `optional` **omit?**: [`offer_items_relOmit`](offer_items_relOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:15407

Omit specific fields from the offer_items_rel

---

### select?

> `optional` **select?**: [`offer_items_relSelect`](offer_items_relSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:15403

Select specific fields to fetch from the offer_items_rel

---

### update

> **update**: [`XOR`](XOR.md)\<[`offer_items_relUpdateInput`](offer_items_relUpdateInput.md), [`offer_items_relUncheckedUpdateInput`](offer_items_relUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:15419

In case the offer_items_rel was found with the provided `where` argument, update it with this data.

---

### where

> **where**: [`offer_items_relWhereUniqueInput`](offer_items_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:15411

The filter to search for the offer_items_rel to update in case it exists.
