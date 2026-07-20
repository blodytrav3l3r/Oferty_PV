[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / Offer\_items\_relAggregateArgs

# Type Alias: Offer\_items\_relAggregateArgs\<ExtArgs\>

> **Offer\_items\_relAggregateArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:14514

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### \_avg?

> `optional` **\_avg?**: [`Offer_items_relAvgAggregateInputType`](Offer_items_relAvgAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:14554

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to average

***

### \_count?

> `optional` **\_count?**: `true` \| [`Offer_items_relCountAggregateInputType`](Offer_items_relCountAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:14548

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Count returned offer_items_rels

***

### \_max?

> `optional` **\_max?**: [`Offer_items_relMaxAggregateInputType`](Offer_items_relMaxAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:14572

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the maximum value

***

### \_min?

> `optional` **\_min?**: [`Offer_items_relMinAggregateInputType`](Offer_items_relMinAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:14566

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the minimum value

***

### \_sum?

> `optional` **\_sum?**: [`Offer_items_relSumAggregateInputType`](Offer_items_relSumAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:14560

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to sum

***

### cursor?

> `optional` **cursor?**: [`offer_items_relWhereUniqueInput`](offer_items_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:14530

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the start position

***

### orderBy?

> `optional` **orderBy?**: [`offer_items_relOrderByWithRelationInput`](offer_items_relOrderByWithRelationInput.md) \| [`offer_items_relOrderByWithRelationInput`](offer_items_relOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:14524

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of offer_items_rels to fetch.

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:14542

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` offer_items_rels.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:14536

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` offer_items_rels from the position of the cursor.

***

### where?

> `optional` **where?**: [`offer_items_relWhereInput`](offer_items_relWhereInput.md)

Defined in: generated/prisma/index.d.ts:14518

Filter which offer_items_rel to aggregate.
