[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiEvaluationAggregateArgs

# Type Alias: AiEvaluationAggregateArgs\<ExtArgs\>

> **AiEvaluationAggregateArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:35206

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### \_avg?

> `optional` **\_avg?**: [`AiEvaluationAvgAggregateInputType`](AiEvaluationAvgAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:35246

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to average

***

### \_count?

> `optional` **\_count?**: `true` \| [`AiEvaluationCountAggregateInputType`](AiEvaluationCountAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:35240

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Count returned AiEvaluations

***

### \_max?

> `optional` **\_max?**: [`AiEvaluationMaxAggregateInputType`](AiEvaluationMaxAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:35264

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the maximum value

***

### \_min?

> `optional` **\_min?**: [`AiEvaluationMinAggregateInputType`](AiEvaluationMinAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:35258

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the minimum value

***

### \_sum?

> `optional` **\_sum?**: [`AiEvaluationSumAggregateInputType`](AiEvaluationSumAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:35252

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to sum

***

### cursor?

> `optional` **cursor?**: [`AiEvaluationWhereUniqueInput`](AiEvaluationWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:35222

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the start position

***

### orderBy?

> `optional` **orderBy?**: [`AiEvaluationOrderByWithRelationInput`](AiEvaluationOrderByWithRelationInput.md) \| [`AiEvaluationOrderByWithRelationInput`](AiEvaluationOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:35216

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of AiEvaluations to fetch.

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:35234

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` AiEvaluations.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:35228

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` AiEvaluations from the position of the cursor.

***

### where?

> `optional` **where?**: [`AiEvaluationWhereInput`](AiEvaluationWhereInput.md)

Defined in: generated/prisma/index.d.ts:35210

Filter which AiEvaluation to aggregate.
