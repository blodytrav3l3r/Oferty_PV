[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / Ai\_recommendationsAggregateArgs

# Type Alias: Ai\_recommendationsAggregateArgs\<ExtArgs\>

> **Ai\_recommendationsAggregateArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:10095

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### \_avg?

> `optional` **\_avg?**: [`Ai_recommendationsAvgAggregateInputType`](Ai_recommendationsAvgAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:10135

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to average

---

### \_count?

> `optional` **\_count?**: `true` \| [`Ai_recommendationsCountAggregateInputType`](Ai_recommendationsCountAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:10129

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Count returned ai_recommendations

---

### \_max?

> `optional` **\_max?**: [`Ai_recommendationsMaxAggregateInputType`](Ai_recommendationsMaxAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:10153

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the maximum value

---

### \_min?

> `optional` **\_min?**: [`Ai_recommendationsMinAggregateInputType`](Ai_recommendationsMinAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:10147

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the minimum value

---

### \_sum?

> `optional` **\_sum?**: [`Ai_recommendationsSumAggregateInputType`](Ai_recommendationsSumAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:10141

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to sum

---

### cursor?

> `optional` **cursor?**: [`ai_recommendationsWhereUniqueInput`](ai_recommendationsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:10111

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the start position

---

### orderBy?

> `optional` **orderBy?**: [`ai_recommendationsOrderByWithRelationInput`](ai_recommendationsOrderByWithRelationInput.md) \| [`ai_recommendationsOrderByWithRelationInput`](ai_recommendationsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:10105

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of ai_recommendations to fetch.

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:10123

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` ai_recommendations.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:10117

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` ai_recommendations from the position of the cursor.

---

### where?

> `optional` **where?**: [`ai_recommendationsWhereInput`](ai_recommendationsWhereInput.md)

Defined in: generated/prisma/index.d.ts:10099

Filter which ai_recommendations to aggregate.
