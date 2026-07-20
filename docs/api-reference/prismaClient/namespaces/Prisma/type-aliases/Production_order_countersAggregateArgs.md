[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / Production\_order\_countersAggregateArgs

# Type Alias: Production\_order\_countersAggregateArgs\<ExtArgs\>

> **Production\_order\_countersAggregateArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:22885

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### \_avg?

> `optional` **\_avg?**: [`Production_order_countersAvgAggregateInputType`](Production_order_countersAvgAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:22925

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to average

***

### \_count?

> `optional` **\_count?**: `true` \| [`Production_order_countersCountAggregateInputType`](Production_order_countersCountAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:22919

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Count returned production_order_counters

***

### \_max?

> `optional` **\_max?**: [`Production_order_countersMaxAggregateInputType`](Production_order_countersMaxAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:22943

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the maximum value

***

### \_min?

> `optional` **\_min?**: [`Production_order_countersMinAggregateInputType`](Production_order_countersMinAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:22937

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the minimum value

***

### \_sum?

> `optional` **\_sum?**: [`Production_order_countersSumAggregateInputType`](Production_order_countersSumAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:22931

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to sum

***

### cursor?

> `optional` **cursor?**: [`production_order_countersWhereUniqueInput`](production_order_countersWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:22901

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the start position

***

### orderBy?

> `optional` **orderBy?**: [`production_order_countersOrderByWithRelationInput`](production_order_countersOrderByWithRelationInput.md) \| [`production_order_countersOrderByWithRelationInput`](production_order_countersOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:22895

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of production_order_counters to fetch.

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:22913

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` production_order_counters.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:22907

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` production_order_counters from the position of the cursor.

***

### where?

> `optional` **where?**: [`production_order_countersWhereInput`](production_order_countersWhereInput.md)

Defined in: generated/prisma/index.d.ts:22889

Filter which production_order_counters to aggregate.
