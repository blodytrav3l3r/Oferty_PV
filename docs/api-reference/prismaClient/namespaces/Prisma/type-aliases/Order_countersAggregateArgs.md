[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / Order\_countersAggregateArgs

# Type Alias: Order\_countersAggregateArgs\<ExtArgs\>

> **Order\_countersAggregateArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:18863

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### \_avg?

> `optional` **\_avg?**: [`Order_countersAvgAggregateInputType`](Order_countersAvgAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:18903

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to average

---

### \_count?

> `optional` **\_count?**: `true` \| [`Order_countersCountAggregateInputType`](Order_countersCountAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:18897

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Count returned order_counters

---

### \_max?

> `optional` **\_max?**: [`Order_countersMaxAggregateInputType`](Order_countersMaxAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:18921

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the maximum value

---

### \_min?

> `optional` **\_min?**: [`Order_countersMinAggregateInputType`](Order_countersMinAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:18915

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the minimum value

---

### \_sum?

> `optional` **\_sum?**: [`Order_countersSumAggregateInputType`](Order_countersSumAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:18909

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to sum

---

### cursor?

> `optional` **cursor?**: [`order_countersWhereUniqueInput`](order_countersWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:18879

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the start position

---

### orderBy?

> `optional` **orderBy?**: [`order_countersOrderByWithRelationInput`](order_countersOrderByWithRelationInput.md) \| [`order_countersOrderByWithRelationInput`](order_countersOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:18873

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of order_counters to fetch.

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:18891

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` order_counters.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:18885

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` order_counters from the position of the cursor.

---

### where?

> `optional` **where?**: [`order_countersWhereInput`](order_countersWhereInput.md)

Defined in: generated/prisma/index.d.ts:18867

Filter which order_counters to aggregate.
