[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / clients\_relUpsertArgs

# Type Alias: clients\_relUpsertArgs\<ExtArgs\>

> **clients\_relUpsertArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:14351

clients_rel upsert

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`clients_relCreateInput`](clients_relCreateInput.md), [`clients_relUncheckedCreateInput`](clients_relUncheckedCreateInput.md)\>

Defined in: generated/prisma/index.d.ts:14367

In case the clients_rel found by the `where` argument doesn't exist, create a new clients_rel with this data.

***

### omit?

> `optional` **omit?**: [`clients_relOmit`](clients_relOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:14359

Omit specific fields from the clients_rel

***

### select?

> `optional` **select?**: [`clients_relSelect`](clients_relSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:14355

Select specific fields to fetch from the clients_rel

***

### update

> **update**: [`XOR`](XOR.md)\<[`clients_relUpdateInput`](clients_relUpdateInput.md), [`clients_relUncheckedUpdateInput`](clients_relUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:14371

In case the clients_rel was found with the provided `where` argument, update it with this data.

***

### where

> **where**: [`clients_relWhereUniqueInput`](clients_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:14363

The filter to search for the clients_rel to update in case it exists.
