[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / Offers\_relAggregateArgs

# Type Alias: Offers\_relAggregateArgs\<ExtArgs\>

> **Offers\_relAggregateArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:16657

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### \_avg?

> `optional` **\_avg?**: [`Offers_relAvgAggregateInputType`](Offers_relAvgAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:16697

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to average

---

### \_count?

> `optional` **\_count?**: `true` \| [`Offers_relCountAggregateInputType`](Offers_relCountAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:16691

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Count returned offers_rels

---

### \_max?

> `optional` **\_max?**: [`Offers_relMaxAggregateInputType`](Offers_relMaxAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:16715

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the maximum value

---

### \_min?

> `optional` **\_min?**: [`Offers_relMinAggregateInputType`](Offers_relMinAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:16709

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the minimum value

---

### \_sum?

> `optional` **\_sum?**: [`Offers_relSumAggregateInputType`](Offers_relSumAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:16703

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to sum

---

### cursor?

> `optional` **cursor?**: [`offers_relWhereUniqueInput`](offers_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:16673

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the start position

---

### orderBy?

> `optional` **orderBy?**: [`offers_relOrderByWithRelationInput`](offers_relOrderByWithRelationInput.md) \| [`offers_relOrderByWithRelationInput`](offers_relOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:16667

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of offers_rels to fetch.

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:16685

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` offers_rels.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:16679

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` offers_rels from the position of the cursor.

---

### where?

> `optional` **where?**: [`offers_relWhereInput`](offers_relWhereInput.md)

Defined in: generated/prisma/index.d.ts:16661

Filter which offers_rel to aggregate.
