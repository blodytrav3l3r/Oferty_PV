[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_recommendationsUpdateManyAndReturnArgs

# Type Alias: ai\_recommendationsUpdateManyAndReturnArgs\<ExtArgs\>

> **ai\_recommendationsUpdateManyAndReturnArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:11010

ai_recommendations updateManyAndReturn

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`ai_recommendationsUpdateManyMutationInput`](ai_recommendationsUpdateManyMutationInput.md), [`ai_recommendationsUncheckedUpdateManyInput`](ai_recommendationsUncheckedUpdateManyInput.md)\>

Defined in: generated/prisma/index.d.ts:11022

The data used to update ai_recommendations.

***

### limit?

> `optional` **limit?**: `number`

Defined in: generated/prisma/index.d.ts:11030

Limit how many ai_recommendations to update.

***

### omit?

> `optional` **omit?**: [`ai_recommendationsOmit`](ai_recommendationsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:11018

Omit specific fields from the ai_recommendations

***

### select?

> `optional` **select?**: [`ai_recommendationsSelectUpdateManyAndReturn`](ai_recommendationsSelectUpdateManyAndReturn.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:11014

Select specific fields to fetch from the ai_recommendations

***

### where?

> `optional` **where?**: [`ai_recommendationsWhereInput`](ai_recommendationsWhereInput.md)

Defined in: generated/prisma/index.d.ts:11026

Filter which ai_recommendations to update
