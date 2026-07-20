[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / offers\_relUpsertArgs

# Type Alias: offers\_relUpsertArgs\<ExtArgs\>

> **offers\_relUpsertArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:17591

offers_rel upsert

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`offers_relCreateInput`](offers_relCreateInput.md), [`offers_relUncheckedCreateInput`](offers_relUncheckedCreateInput.md)\>

Defined in: generated/prisma/index.d.ts:17607

In case the offers_rel found by the `where` argument doesn't exist, create a new offers_rel with this data.

***

### omit?

> `optional` **omit?**: [`offers_relOmit`](offers_relOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:17599

Omit specific fields from the offers_rel

***

### select?

> `optional` **select?**: [`offers_relSelect`](offers_relSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:17595

Select specific fields to fetch from the offers_rel

***

### update

> **update**: [`XOR`](XOR.md)\<[`offers_relUpdateInput`](offers_relUpdateInput.md), [`offers_relUncheckedUpdateInput`](offers_relUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:17611

In case the offers_rel was found with the provided `where` argument, update it with this data.

***

### where

> **where**: [`offers_relWhereUniqueInput`](offers_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:17603

The filter to search for the offers_rel to update in case it exists.
