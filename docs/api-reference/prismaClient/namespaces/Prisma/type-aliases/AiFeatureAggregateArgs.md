[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiFeatureAggregateArgs

# Type Alias: AiFeatureAggregateArgs\<ExtArgs\>

> **AiFeatureAggregateArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:32914

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### \_avg?

> `optional` **\_avg?**: [`AiFeatureAvgAggregateInputType`](AiFeatureAvgAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:32954

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to average

---

### \_count?

> `optional` **\_count?**: `true` \| [`AiFeatureCountAggregateInputType`](AiFeatureCountAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:32948

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Count returned AiFeatures

---

### \_max?

> `optional` **\_max?**: [`AiFeatureMaxAggregateInputType`](AiFeatureMaxAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:32972

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the maximum value

---

### \_min?

> `optional` **\_min?**: [`AiFeatureMinAggregateInputType`](AiFeatureMinAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:32966

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the minimum value

---

### \_sum?

> `optional` **\_sum?**: [`AiFeatureSumAggregateInputType`](AiFeatureSumAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:32960

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to sum

---

### cursor?

> `optional` **cursor?**: [`AiFeatureWhereUniqueInput`](AiFeatureWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:32930

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the start position

---

### orderBy?

> `optional` **orderBy?**: [`AiFeatureOrderByWithRelationInput`](AiFeatureOrderByWithRelationInput.md) \| [`AiFeatureOrderByWithRelationInput`](AiFeatureOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:32924

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of AiFeatures to fetch.

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:32942

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` AiFeatures.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:32936

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` AiFeatures from the position of the cursor.

---

### where?

> `optional` **where?**: [`AiFeatureWhereInput`](AiFeatureWhereInput.md)

Defined in: generated/prisma/index.d.ts:32918

Filter which AiFeature to aggregate.
