[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiEvaluationUpdateArgs

# Type Alias: AiEvaluationUpdateArgs\<ExtArgs\>

> **AiEvaluationUpdateArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:36032

AiEvaluation update

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`AiEvaluationUpdateInput`](AiEvaluationUpdateInput.md), [`AiEvaluationUncheckedUpdateInput`](AiEvaluationUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:36044

The data needed to update a AiEvaluation.

***

### omit?

> `optional` **omit?**: [`AiEvaluationOmit`](AiEvaluationOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:36040

Omit specific fields from the AiEvaluation

***

### select?

> `optional` **select?**: [`AiEvaluationSelect`](AiEvaluationSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:36036

Select specific fields to fetch from the AiEvaluation

***

### where

> **where**: [`AiEvaluationWhereUniqueInput`](AiEvaluationWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:36048

Choose, which AiEvaluation to update.
