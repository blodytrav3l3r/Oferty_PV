[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / offer\_studnie\_items\_relUpsertArgs

# Type Alias: offer\_studnie\_items\_relUpsertArgs\<ExtArgs\>

> **offer\_studnie\_items\_relUpsertArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:16460

offer_studnie_items_rel upsert

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`offer_studnie_items_relCreateInput`](offer_studnie_items_relCreateInput.md), [`offer_studnie_items_relUncheckedCreateInput`](offer_studnie_items_relUncheckedCreateInput.md)\>

Defined in: generated/prisma/index.d.ts:16476

In case the offer_studnie_items_rel found by the `where` argument doesn't exist, create a new offer_studnie_items_rel with this data.

***

### omit?

> `optional` **omit?**: [`offer_studnie_items_relOmit`](offer_studnie_items_relOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:16468

Omit specific fields from the offer_studnie_items_rel

***

### select?

> `optional` **select?**: [`offer_studnie_items_relSelect`](offer_studnie_items_relSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:16464

Select specific fields to fetch from the offer_studnie_items_rel

***

### update

> **update**: [`XOR`](XOR.md)\<[`offer_studnie_items_relUpdateInput`](offer_studnie_items_relUpdateInput.md), [`offer_studnie_items_relUncheckedUpdateInput`](offer_studnie_items_relUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:16480

In case the offer_studnie_items_rel was found with the provided `where` argument, update it with this data.

***

### where

> **where**: [`offer_studnie_items_relWhereUniqueInput`](offer_studnie_items_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:16472

The filter to search for the offer_studnie_items_rel to update in case it exists.
