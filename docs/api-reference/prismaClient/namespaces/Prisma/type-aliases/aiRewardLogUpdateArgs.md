[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / aiRewardLogUpdateArgs

# Type Alias: aiRewardLogUpdateArgs\<ExtArgs\>

> **aiRewardLogUpdateArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:37149

aiRewardLog update

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`aiRewardLogUpdateInput`](aiRewardLogUpdateInput.md), [`aiRewardLogUncheckedUpdateInput`](aiRewardLogUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:37161

The data needed to update a aiRewardLog.

---

### omit?

> `optional` **omit?**: [`aiRewardLogOmit`](aiRewardLogOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:37157

Omit specific fields from the aiRewardLog

---

### select?

> `optional` **select?**: [`aiRewardLogSelect`](aiRewardLogSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:37153

Select specific fields to fetch from the aiRewardLog

---

### where

> **where**: [`aiRewardLogWhereUniqueInput`](aiRewardLogWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:37165

Choose, which aiRewardLog to update.
