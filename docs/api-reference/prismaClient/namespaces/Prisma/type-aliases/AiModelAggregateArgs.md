[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiModelAggregateArgs

# Type Alias: AiModelAggregateArgs\<ExtArgs\>

> **AiModelAggregateArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:34106

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### \_avg?

> `optional` **\_avg?**: [`AiModelAvgAggregateInputType`](AiModelAvgAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:34146

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to average

---

### \_count?

> `optional` **\_count?**: `true` \| [`AiModelCountAggregateInputType`](AiModelCountAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:34140

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Count returned AiModels

---

### \_max?

> `optional` **\_max?**: [`AiModelMaxAggregateInputType`](AiModelMaxAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:34164

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the maximum value

---

### \_min?

> `optional` **\_min?**: [`AiModelMinAggregateInputType`](AiModelMinAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:34158

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the minimum value

---

### \_sum?

> `optional` **\_sum?**: [`AiModelSumAggregateInputType`](AiModelSumAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:34152

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to sum

---

### cursor?

> `optional` **cursor?**: [`AiModelWhereUniqueInput`](AiModelWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:34122

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the start position

---

### orderBy?

> `optional` **orderBy?**: [`AiModelOrderByWithRelationInput`](AiModelOrderByWithRelationInput.md) \| [`AiModelOrderByWithRelationInput`](AiModelOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:34116

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of AiModels to fetch.

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:34134

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` AiModels.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:34128

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` AiModels from the position of the cursor.

---

### where?

> `optional` **where?**: [`AiModelWhereInput`](AiModelWhereInput.md)

Defined in: generated/prisma/index.d.ts:34110

Filter which AiModel to aggregate.
