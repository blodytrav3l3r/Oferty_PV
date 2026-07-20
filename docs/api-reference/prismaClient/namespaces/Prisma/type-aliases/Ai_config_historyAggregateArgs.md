[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / Ai\_config\_historyAggregateArgs

# Type Alias: Ai\_config\_historyAggregateArgs\<ExtArgs\>

> **Ai\_config\_historyAggregateArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:6721

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### \_avg?

> `optional` **\_avg?**: [`Ai_config_historyAvgAggregateInputType`](Ai_config_historyAvgAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:6761

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to average

***

### \_count?

> `optional` **\_count?**: `true` \| [`Ai_config_historyCountAggregateInputType`](Ai_config_historyCountAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:6755

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Count returned ai_config_histories

***

### \_max?

> `optional` **\_max?**: [`Ai_config_historyMaxAggregateInputType`](Ai_config_historyMaxAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:6779

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the maximum value

***

### \_min?

> `optional` **\_min?**: [`Ai_config_historyMinAggregateInputType`](Ai_config_historyMinAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:6773

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the minimum value

***

### \_sum?

> `optional` **\_sum?**: [`Ai_config_historySumAggregateInputType`](Ai_config_historySumAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:6767

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to sum

***

### cursor?

> `optional` **cursor?**: [`ai_config_historyWhereUniqueInput`](ai_config_historyWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:6737

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the start position

***

### orderBy?

> `optional` **orderBy?**: [`ai_config_historyOrderByWithRelationInput`](ai_config_historyOrderByWithRelationInput.md) \| [`ai_config_historyOrderByWithRelationInput`](ai_config_historyOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:6731

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of ai_config_histories to fetch.

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:6749

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` ai_config_histories.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:6743

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` ai_config_histories from the position of the cursor.

***

### where?

> `optional` **where?**: [`ai_config_historyWhereInput`](ai_config_historyWhereInput.md)

Defined in: generated/prisma/index.d.ts:6725

Filter which ai_config_history to aggregate.
