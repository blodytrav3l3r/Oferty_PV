[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / offer\_items\_relUpdateArgs

# Type Alias: offer\_items\_relUpdateArgs\<ExtArgs\>

> **offer\_items\_relUpdateArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:15333

offer_items_rel update

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`offer_items_relUpdateInput`](offer_items_relUpdateInput.md), [`offer_items_relUncheckedUpdateInput`](offer_items_relUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:15345

The data needed to update a offer_items_rel.

***

### omit?

> `optional` **omit?**: [`offer_items_relOmit`](offer_items_relOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:15341

Omit specific fields from the offer_items_rel

***

### select?

> `optional` **select?**: [`offer_items_relSelect`](offer_items_relSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:15337

Select specific fields to fetch from the offer_items_rel

***

### where

> **where**: [`offer_items_relWhereUniqueInput`](offer_items_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:15349

Choose, which offer_items_rel to update.
