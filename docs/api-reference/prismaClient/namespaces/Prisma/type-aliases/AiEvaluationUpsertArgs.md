[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiEvaluationUpsertArgs

# Type Alias: AiEvaluationUpsertArgs\<ExtArgs\>

> **AiEvaluationUpsertArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:36098

AiEvaluation upsert

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`AiEvaluationCreateInput`](AiEvaluationCreateInput.md), [`AiEvaluationUncheckedCreateInput`](AiEvaluationUncheckedCreateInput.md)\>

Defined in: generated/prisma/index.d.ts:36114

In case the AiEvaluation found by the `where` argument doesn't exist, create a new AiEvaluation with this data.

***

### omit?

> `optional` **omit?**: [`AiEvaluationOmit`](AiEvaluationOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:36106

Omit specific fields from the AiEvaluation

***

### select?

> `optional` **select?**: [`AiEvaluationSelect`](AiEvaluationSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:36102

Select specific fields to fetch from the AiEvaluation

***

### update

> **update**: [`XOR`](XOR.md)\<[`AiEvaluationUpdateInput`](AiEvaluationUpdateInput.md), [`AiEvaluationUncheckedUpdateInput`](AiEvaluationUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:36118

In case the AiEvaluation was found with the provided `where` argument, update it with this data.

***

### where

> **where**: [`AiEvaluationWhereUniqueInput`](AiEvaluationWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:36110

The filter to search for the AiEvaluation to update in case it exists.
