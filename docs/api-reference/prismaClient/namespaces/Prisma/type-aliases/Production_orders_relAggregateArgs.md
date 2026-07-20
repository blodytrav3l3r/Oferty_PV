[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / Production\_orders\_relAggregateArgs

# Type Alias: Production\_orders\_relAggregateArgs\<ExtArgs\>

> **Production\_orders\_relAggregateArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:23922

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### \_avg?

> `optional` **\_avg?**: [`Production_orders_relAvgAggregateInputType`](Production_orders_relAvgAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:23962

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to average

---

### \_count?

> `optional` **\_count?**: `true` \| [`Production_orders_relCountAggregateInputType`](Production_orders_relCountAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:23956

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Count returned production_orders_rels

---

### \_max?

> `optional` **\_max?**: [`Production_orders_relMaxAggregateInputType`](Production_orders_relMaxAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:23980

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the maximum value

---

### \_min?

> `optional` **\_min?**: [`Production_orders_relMinAggregateInputType`](Production_orders_relMinAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:23974

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the minimum value

---

### \_sum?

> `optional` **\_sum?**: [`Production_orders_relSumAggregateInputType`](Production_orders_relSumAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:23968

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to sum

---

### cursor?

> `optional` **cursor?**: [`production_orders_relWhereUniqueInput`](production_orders_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:23938

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the start position

---

### orderBy?

> `optional` **orderBy?**: [`production_orders_relOrderByWithRelationInput`](production_orders_relOrderByWithRelationInput.md) \| [`production_orders_relOrderByWithRelationInput`](production_orders_relOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:23932

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of production_orders_rels to fetch.

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:23950

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` production_orders_rels.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:23944

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` production_orders_rels from the position of the cursor.

---

### where?

> `optional` **where?**: [`production_orders_relWhereInput`](production_orders_relWhereInput.md)

Defined in: generated/prisma/index.d.ts:23926

Filter which production_orders_rel to aggregate.
