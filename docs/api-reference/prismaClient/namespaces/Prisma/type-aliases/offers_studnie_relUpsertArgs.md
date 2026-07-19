[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / offers\_studnie\_relUpsertArgs

# Type Alias: offers\_studnie\_relUpsertArgs\<ExtArgs\>

> **offers\_studnie\_relUpsertArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:18722

offers_studnie_rel upsert

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`offers_studnie_relCreateInput`](offers_studnie_relCreateInput.md), [`offers_studnie_relUncheckedCreateInput`](offers_studnie_relUncheckedCreateInput.md)>\>

Defined in: generated/prisma/index.d.ts:18738

In case the offers_studnie_rel found by the `where` argument doesn't exist, create a new offers_studnie_rel with this data.

---

### omit?

> `optional` **omit?**: [`offers_studnie_relOmit`](offers_studnie_relOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:18730

Omit specific fields from the offers_studnie_rel

---

### select?

> `optional` **select?**: [`offers_studnie_relSelect`](offers_studnie_relSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:18726

Select specific fields to fetch from the offers_studnie_rel

---

### update

> **update**: [`XOR`](XOR.md)\<[`offers_studnie_relUpdateInput`](offers_studnie_relUpdateInput.md), [`offers_studnie_relUncheckedUpdateInput`](offers_studnie_relUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:18742

In case the offers_studnie_rel was found with the provided `where` argument, update it with this data.

---

### where

> **where**: [`offers_studnie_relWhereUniqueInput`](offers_studnie_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:18734

The filter to search for the offers_studnie_rel to update in case it exists.
