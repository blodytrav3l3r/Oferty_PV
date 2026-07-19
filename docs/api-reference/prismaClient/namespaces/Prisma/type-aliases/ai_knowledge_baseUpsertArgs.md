[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_knowledge\_baseUpsertArgs

# Type Alias: ai\_knowledge\_baseUpsertArgs\<ExtArgs\>

> **ai\_knowledge\_baseUpsertArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:9888

ai_knowledge_base upsert

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`ai_knowledge_baseCreateInput`](ai_knowledge_baseCreateInput.md), [`ai_knowledge_baseUncheckedCreateInput`](ai_knowledge_baseUncheckedCreateInput.md)>\>

Defined in: generated/prisma/index.d.ts:9904

In case the ai_knowledge_base found by the `where` argument doesn't exist, create a new ai_knowledge_base with this data.

---

### omit?

> `optional` **omit?**: [`ai_knowledge_baseOmit`](ai_knowledge_baseOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:9896

Omit specific fields from the ai_knowledge_base

---

### select?

> `optional` **select?**: [`ai_knowledge_baseSelect`](ai_knowledge_baseSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:9892

Select specific fields to fetch from the ai_knowledge_base

---

### update

> **update**: [`XOR`](XOR.md)\<[`ai_knowledge_baseUpdateInput`](ai_knowledge_baseUpdateInput.md), [`ai_knowledge_baseUncheckedUpdateInput`](ai_knowledge_baseUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:9908

In case the ai_knowledge_base was found with the provided `where` argument, update it with this data.

---

### where

> **where**: [`ai_knowledge_baseWhereUniqueInput`](ai_knowledge_baseWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:9900

The filter to search for the ai_knowledge_base to update in case it exists.
