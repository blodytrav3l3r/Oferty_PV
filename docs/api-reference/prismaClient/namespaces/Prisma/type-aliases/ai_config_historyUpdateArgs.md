[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_config\_historyUpdateArgs

# Type Alias: ai\_config\_historyUpdateArgs\<ExtArgs\>

> **ai\_config\_historyUpdateArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:7582

ai_config_history update

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`ai_config_historyUpdateInput`](ai_config_historyUpdateInput.md), [`ai_config_historyUncheckedUpdateInput`](ai_config_historyUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:7594

The data needed to update a ai_config_history.

---

### omit?

> `optional` **omit?**: [`ai_config_historyOmit`](ai_config_historyOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:7590

Omit specific fields from the ai_config_history

---

### select?

> `optional` **select?**: [`ai_config_historySelect`](ai_config_historySelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:7586

Select specific fields to fetch from the ai_config_history

---

### where

> **where**: [`ai_config_historyWhereUniqueInput`](ai_config_historyWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:7598

Choose, which ai_config_history to update.
