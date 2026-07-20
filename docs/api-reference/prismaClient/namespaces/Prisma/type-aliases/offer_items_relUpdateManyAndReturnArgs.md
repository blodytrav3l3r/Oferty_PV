[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / offer\_items\_relUpdateManyAndReturnArgs

# Type Alias: offer\_items\_relUpdateManyAndReturnArgs\<ExtArgs\>

> **offer\_items\_relUpdateManyAndReturnArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:15373

offer_items_rel updateManyAndReturn

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`offer_items_relUpdateManyMutationInput`](offer_items_relUpdateManyMutationInput.md), [`offer_items_relUncheckedUpdateManyInput`](offer_items_relUncheckedUpdateManyInput.md)>\>

Defined in: generated/prisma/index.d.ts:15385

The data used to update offer_items_rels.

---

### limit?

> `optional` **limit?**: `number`

Defined in: generated/prisma/index.d.ts:15393

Limit how many offer_items_rels to update.

---

### omit?

> `optional` **omit?**: [`offer_items_relOmit`](offer_items_relOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:15381

Omit specific fields from the offer_items_rel

---

### select?

> `optional` **select?**: [`offer_items_relSelectUpdateManyAndReturn`](offer_items_relSelectUpdateManyAndReturn.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:15377

Select specific fields to fetch from the offer_items_rel

---

### where?

> `optional` **where?**: [`offer_items_relWhereInput`](offer_items_relWhereInput.md)

Defined in: generated/prisma/index.d.ts:15389

Filter which offer_items_rels to update
