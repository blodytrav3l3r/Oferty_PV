[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / aiRewardLogUpsertArgs

# Type Alias: aiRewardLogUpsertArgs\<ExtArgs\>

> **aiRewardLogUpsertArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:37215

aiRewardLog upsert

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`aiRewardLogCreateInput`](aiRewardLogCreateInput.md), [`aiRewardLogUncheckedCreateInput`](aiRewardLogUncheckedCreateInput.md)>\>

Defined in: generated/prisma/index.d.ts:37231

In case the aiRewardLog found by the `where` argument doesn't exist, create a new aiRewardLog with this data.

---

### omit?

> `optional` **omit?**: [`aiRewardLogOmit`](aiRewardLogOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:37223

Omit specific fields from the aiRewardLog

---

### select?

> `optional` **select?**: [`aiRewardLogSelect`](aiRewardLogSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:37219

Select specific fields to fetch from the aiRewardLog

---

### update

> **update**: [`XOR`](XOR.md)\<[`aiRewardLogUpdateInput`](aiRewardLogUpdateInput.md), [`aiRewardLogUncheckedUpdateInput`](aiRewardLogUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:37235

In case the aiRewardLog was found with the provided `where` argument, update it with this data.

---

### where

> **where**: [`aiRewardLogWhereUniqueInput`](aiRewardLogWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:37227

The filter to search for the aiRewardLog to update in case it exists.
