[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / clients\_relUpdateArgs

# Type Alias: clients\_relUpdateArgs\<ExtArgs\>

> **clients\_relUpdateArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:14285

clients_rel update

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`clients_relUpdateInput`](clients_relUpdateInput.md), [`clients_relUncheckedUpdateInput`](clients_relUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:14297

The data needed to update a clients_rel.

***

### omit?

> `optional` **omit?**: [`clients_relOmit`](clients_relOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:14293

Omit specific fields from the clients_rel

***

### select?

> `optional` **select?**: [`clients_relSelect`](clients_relSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:14289

Select specific fields to fetch from the clients_rel

***

### where

> **where**: [`clients_relWhereUniqueInput`](clients_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:14301

Choose, which clients_rel to update.
