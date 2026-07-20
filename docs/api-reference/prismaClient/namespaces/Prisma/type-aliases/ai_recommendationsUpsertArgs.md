[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_recommendationsUpsertArgs

# Type Alias: ai\_recommendationsUpsertArgs\<ExtArgs\>

> **ai\_recommendationsUpsertArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:11036

ai_recommendations upsert

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`ai_recommendationsCreateInput`](ai_recommendationsCreateInput.md), [`ai_recommendationsUncheckedCreateInput`](ai_recommendationsUncheckedCreateInput.md)\>

Defined in: generated/prisma/index.d.ts:11052

In case the ai_recommendations found by the `where` argument doesn't exist, create a new ai_recommendations with this data.

***

### omit?

> `optional` **omit?**: [`ai_recommendationsOmit`](ai_recommendationsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:11044

Omit specific fields from the ai_recommendations

***

### select?

> `optional` **select?**: [`ai_recommendationsSelect`](ai_recommendationsSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:11040

Select specific fields to fetch from the ai_recommendations

***

### update

> **update**: [`XOR`](XOR.md)\<[`ai_recommendationsUpdateInput`](ai_recommendationsUpdateInput.md), [`ai_recommendationsUncheckedUpdateInput`](ai_recommendationsUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:11056

In case the ai_recommendations was found with the provided `where` argument, update it with this data.

***

### where

> **where**: [`ai_recommendationsWhereUniqueInput`](ai_recommendationsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:11048

The filter to search for the ai_recommendations to update in case it exists.
