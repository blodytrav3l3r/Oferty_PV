[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / orders\_rury\_relUpsertArgs

# Type Alias: orders\_rury\_relUpsertArgs\<ExtArgs\>

> **orders\_rury\_relUpsertArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:22744

orders_rury_rel upsert

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`orders_rury_relCreateInput`](orders_rury_relCreateInput.md), [`orders_rury_relUncheckedCreateInput`](orders_rury_relUncheckedCreateInput.md)\>

Defined in: generated/prisma/index.d.ts:22760

In case the orders_rury_rel found by the `where` argument doesn't exist, create a new orders_rury_rel with this data.

***

### omit?

> `optional` **omit?**: [`orders_rury_relOmit`](orders_rury_relOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:22752

Omit specific fields from the orders_rury_rel

***

### select?

> `optional` **select?**: [`orders_rury_relSelect`](orders_rury_relSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:22748

Select specific fields to fetch from the orders_rury_rel

***

### update

> **update**: [`XOR`](XOR.md)\<[`orders_rury_relUpdateInput`](orders_rury_relUpdateInput.md), [`orders_rury_relUncheckedUpdateInput`](orders_rury_relUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:22764

In case the orders_rury_rel was found with the provided `where` argument, update it with this data.

***

### where

> **where**: [`orders_rury_relWhereUniqueInput`](orders_rury_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:22756

The filter to search for the orders_rury_rel to update in case it exists.
