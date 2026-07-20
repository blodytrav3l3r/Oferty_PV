[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiFeatureUpdateArgs

# Type Alias: AiFeatureUpdateArgs\<ExtArgs\>

> **AiFeatureUpdateArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:33845

AiFeature update

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`AiFeatureUpdateInput`](AiFeatureUpdateInput.md), [`AiFeatureUncheckedUpdateInput`](AiFeatureUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:33857

The data needed to update a AiFeature.

***

### omit?

> `optional` **omit?**: [`AiFeatureOmit`](AiFeatureOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:33853

Omit specific fields from the AiFeature

***

### select?

> `optional` **select?**: [`AiFeatureSelect`](AiFeatureSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:33849

Select specific fields to fetch from the AiFeature

***

### where

> **where**: [`AiFeatureWhereUniqueInput`](AiFeatureWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:33861

Choose, which AiFeature to update.
