[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / production\_orders\_relUpdateArgs

# Type Alias: production\_orders\_relUpdateArgs\<ExtArgs\>

> **production\_orders\_relUpdateArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:24762

production_orders_rel update

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`production_orders_relUpdateInput`](production_orders_relUpdateInput.md), [`production_orders_relUncheckedUpdateInput`](production_orders_relUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:24774

The data needed to update a production_orders_rel.

***

### omit?

> `optional` **omit?**: [`production_orders_relOmit`](production_orders_relOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:24770

Omit specific fields from the production_orders_rel

***

### select?

> `optional` **select?**: [`production_orders_relSelect`](production_orders_relSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:24766

Select specific fields to fetch from the production_orders_rel

***

### where

> **where**: [`production_orders_relWhereUniqueInput`](production_orders_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:24778

Choose, which production_orders_rel to update.
