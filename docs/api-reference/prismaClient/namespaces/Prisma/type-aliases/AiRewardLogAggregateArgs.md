[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiRewardLogAggregateArgs

# Type Alias: AiRewardLogAggregateArgs\<ExtArgs\>

> **AiRewardLogAggregateArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:36295

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### \_avg?

> `optional` **\_avg?**: [`AiRewardLogAvgAggregateInputType`](AiRewardLogAvgAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:36335

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to average

***

### \_count?

> `optional` **\_count?**: `true` \| [`AiRewardLogCountAggregateInputType`](AiRewardLogCountAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:36329

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Count returned aiRewardLogs

***

### \_max?

> `optional` **\_max?**: [`AiRewardLogMaxAggregateInputType`](AiRewardLogMaxAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:36353

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the maximum value

***

### \_min?

> `optional` **\_min?**: [`AiRewardLogMinAggregateInputType`](AiRewardLogMinAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:36347

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the minimum value

***

### \_sum?

> `optional` **\_sum?**: [`AiRewardLogSumAggregateInputType`](AiRewardLogSumAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:36341

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to sum

***

### cursor?

> `optional` **cursor?**: [`aiRewardLogWhereUniqueInput`](aiRewardLogWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:36311

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the start position

***

### orderBy?

> `optional` **orderBy?**: [`aiRewardLogOrderByWithRelationInput`](aiRewardLogOrderByWithRelationInput.md) \| [`aiRewardLogOrderByWithRelationInput`](aiRewardLogOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:36305

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of aiRewardLogs to fetch.

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:36323

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` aiRewardLogs.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:36317

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` aiRewardLogs from the position of the cursor.

***

### where?

> `optional` **where?**: [`aiRewardLogWhereInput`](aiRewardLogWhereInput.md)

Defined in: generated/prisma/index.d.ts:36299

Filter which aiRewardLog to aggregate.
