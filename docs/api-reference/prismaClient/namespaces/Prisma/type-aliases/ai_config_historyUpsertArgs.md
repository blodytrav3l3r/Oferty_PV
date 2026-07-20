[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_config\_historyUpsertArgs

# Type Alias: ai\_config\_historyUpsertArgs\<ExtArgs\>

> **ai\_config\_historyUpsertArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:7648

ai_config_history upsert

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`ai_config_historyCreateInput`](ai_config_historyCreateInput.md), [`ai_config_historyUncheckedCreateInput`](ai_config_historyUncheckedCreateInput.md)>\>

Defined in: generated/prisma/index.d.ts:7664

In case the ai_config_history found by the `where` argument doesn't exist, create a new ai_config_history with this data.

---

### omit?

> `optional` **omit?**: [`ai_config_historyOmit`](ai_config_historyOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:7656

Omit specific fields from the ai_config_history

---

### select?

> `optional` **select?**: [`ai_config_historySelect`](ai_config_historySelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:7652

Select specific fields to fetch from the ai_config_history

---

### update

> **update**: [`XOR`](XOR.md)\<[`ai_config_historyUpdateInput`](ai_config_historyUpdateInput.md), [`ai_config_historyUncheckedUpdateInput`](ai_config_historyUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:7668

In case the ai_config_history was found with the provided `where` argument, update it with this data.

---

### where

> **where**: [`ai_config_historyWhereUniqueInput`](ai_config_historyWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:7660

The filter to search for the ai_config_history to update in case it exists.
