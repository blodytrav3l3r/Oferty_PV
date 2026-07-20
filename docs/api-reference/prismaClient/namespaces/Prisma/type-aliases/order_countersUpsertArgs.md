[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / order\_countersUpsertArgs

# Type Alias: order\_countersUpsertArgs\<ExtArgs\>

> **order\_countersUpsertArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:19727

order_counters upsert

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`order_countersCreateInput`](order_countersCreateInput.md), [`order_countersUncheckedCreateInput`](order_countersUncheckedCreateInput.md)\>

Defined in: generated/prisma/index.d.ts:19743

In case the order_counters found by the `where` argument doesn't exist, create a new order_counters with this data.

***

### omit?

> `optional` **omit?**: [`order_countersOmit`](order_countersOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:19735

Omit specific fields from the order_counters

***

### select?

> `optional` **select?**: [`order_countersSelect`](order_countersSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:19731

Select specific fields to fetch from the order_counters

***

### update

> **update**: [`XOR`](XOR.md)\<[`order_countersUpdateInput`](order_countersUpdateInput.md), [`order_countersUncheckedUpdateInput`](order_countersUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:19747

In case the order_counters was found with the provided `where` argument, update it with this data.

***

### where

> **where**: [`order_countersWhereUniqueInput`](order_countersWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:19739

The filter to search for the order_counters to update in case it exists.
