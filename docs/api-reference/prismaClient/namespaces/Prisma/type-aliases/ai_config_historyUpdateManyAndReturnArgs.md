[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_config\_historyUpdateManyAndReturnArgs

# Type Alias: ai\_config\_historyUpdateManyAndReturnArgs\<ExtArgs\>

> **ai\_config\_historyUpdateManyAndReturnArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:7622

ai_config_history updateManyAndReturn

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`ai_config_historyUpdateManyMutationInput`](ai_config_historyUpdateManyMutationInput.md), [`ai_config_historyUncheckedUpdateManyInput`](ai_config_historyUncheckedUpdateManyInput.md)>\>

Defined in: generated/prisma/index.d.ts:7634

The data used to update ai_config_histories.

---

### limit?

> `optional` **limit?**: `number`

Defined in: generated/prisma/index.d.ts:7642

Limit how many ai_config_histories to update.

---

### omit?

> `optional` **omit?**: [`ai_config_historyOmit`](ai_config_historyOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:7630

Omit specific fields from the ai_config_history

---

### select?

> `optional` **select?**: [`ai_config_historySelectUpdateManyAndReturn`](ai_config_historySelectUpdateManyAndReturn.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:7626

Select specific fields to fetch from the ai_config_history

---

### where?

> `optional` **where?**: [`ai_config_historyWhereInput`](ai_config_historyWhereInput.md)

Defined in: generated/prisma/index.d.ts:7638

Filter which ai_config_histories to update
