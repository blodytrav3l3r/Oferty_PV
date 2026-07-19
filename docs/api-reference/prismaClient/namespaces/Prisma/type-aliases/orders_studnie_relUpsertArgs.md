[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / orders\_studnie\_relUpsertArgs

# Type Alias: orders\_studnie\_relUpsertArgs\<ExtArgs\>

> **orders\_studnie\_relUpsertArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:21738

orders_studnie_rel upsert

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`orders_studnie_relCreateInput`](orders_studnie_relCreateInput.md), [`orders_studnie_relUncheckedCreateInput`](orders_studnie_relUncheckedCreateInput.md)>\>

Defined in: generated/prisma/index.d.ts:21754

In case the orders_studnie_rel found by the `where` argument doesn't exist, create a new orders_studnie_rel with this data.

---

### omit?

> `optional` **omit?**: [`orders_studnie_relOmit`](orders_studnie_relOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:21746

Omit specific fields from the orders_studnie_rel

---

### select?

> `optional` **select?**: [`orders_studnie_relSelect`](orders_studnie_relSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:21742

Select specific fields to fetch from the orders_studnie_rel

---

### update

> **update**: [`XOR`](XOR.md)\<[`orders_studnie_relUpdateInput`](orders_studnie_relUpdateInput.md), [`orders_studnie_relUncheckedUpdateInput`](orders_studnie_relUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:21758

In case the orders_studnie_rel was found with the provided `where` argument, update it with this data.

---

### where

> **where**: [`orders_studnie_relWhereUniqueInput`](orders_studnie_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:21750

The filter to search for the orders_studnie_rel to update in case it exists.
