[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiFeatureUpsertArgs

# Type Alias: AiFeatureUpsertArgs\<ExtArgs\>

> **AiFeatureUpsertArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:33911

AiFeature upsert

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`AiFeatureCreateInput`](AiFeatureCreateInput.md), [`AiFeatureUncheckedCreateInput`](AiFeatureUncheckedCreateInput.md)>\>

Defined in: generated/prisma/index.d.ts:33927

In case the AiFeature found by the `where` argument doesn't exist, create a new AiFeature with this data.

---

### omit?

> `optional` **omit?**: [`AiFeatureOmit`](AiFeatureOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:33919

Omit specific fields from the AiFeature

---

### select?

> `optional` **select?**: [`AiFeatureSelect`](AiFeatureSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:33915

Select specific fields to fetch from the AiFeature

---

### update

> **update**: [`XOR`](XOR.md)\<[`AiFeatureUpdateInput`](AiFeatureUpdateInput.md), [`AiFeatureUncheckedUpdateInput`](AiFeatureUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:33931

In case the AiFeature was found with the provided `where` argument, update it with this data.

---

### where

> **where**: [`AiFeatureWhereUniqueInput`](AiFeatureWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:33923

The filter to search for the AiFeature to update in case it exists.
