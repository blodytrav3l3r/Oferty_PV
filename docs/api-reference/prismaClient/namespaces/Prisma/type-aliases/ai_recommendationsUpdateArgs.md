[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_recommendationsUpdateArgs

# Type Alias: ai\_recommendationsUpdateArgs\<ExtArgs\>

> **ai\_recommendationsUpdateArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:10970

ai_recommendations update

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`ai_recommendationsUpdateInput`](ai_recommendationsUpdateInput.md), [`ai_recommendationsUncheckedUpdateInput`](ai_recommendationsUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:10982

The data needed to update a ai_recommendations.

***

### omit?

> `optional` **omit?**: [`ai_recommendationsOmit`](ai_recommendationsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:10978

Omit specific fields from the ai_recommendations

***

### select?

> `optional` **select?**: [`ai_recommendationsSelect`](ai_recommendationsSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:10974

Select specific fields to fetch from the ai_recommendations

***

### where

> **where**: [`ai_recommendationsWhereUniqueInput`](ai_recommendationsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:10986

Choose, which ai_recommendations to update.
