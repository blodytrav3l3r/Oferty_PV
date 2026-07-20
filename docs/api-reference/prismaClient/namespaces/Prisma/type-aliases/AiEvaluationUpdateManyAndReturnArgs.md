[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiEvaluationUpdateManyAndReturnArgs

# Type Alias: AiEvaluationUpdateManyAndReturnArgs\<ExtArgs\>

> **AiEvaluationUpdateManyAndReturnArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:36072

AiEvaluation updateManyAndReturn

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`AiEvaluationUpdateManyMutationInput`](AiEvaluationUpdateManyMutationInput.md), [`AiEvaluationUncheckedUpdateManyInput`](AiEvaluationUncheckedUpdateManyInput.md)\>

Defined in: generated/prisma/index.d.ts:36084

The data used to update AiEvaluations.

***

### limit?

> `optional` **limit?**: `number`

Defined in: generated/prisma/index.d.ts:36092

Limit how many AiEvaluations to update.

***

### omit?

> `optional` **omit?**: [`AiEvaluationOmit`](AiEvaluationOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:36080

Omit specific fields from the AiEvaluation

***

### select?

> `optional` **select?**: [`AiEvaluationSelectUpdateManyAndReturn`](AiEvaluationSelectUpdateManyAndReturn.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:36076

Select specific fields to fetch from the AiEvaluation

***

### where?

> `optional` **where?**: [`AiEvaluationWhereInput`](AiEvaluationWhereInput.md)

Defined in: generated/prisma/index.d.ts:36088

Filter which AiEvaluations to update
