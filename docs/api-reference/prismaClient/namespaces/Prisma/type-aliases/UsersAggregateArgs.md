[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / UsersAggregateArgs

# Type Alias: UsersAggregateArgs\<ExtArgs\>

> **UsersAggregateArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:37426

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### \_avg?

> `optional` **\_avg?**: [`UsersAvgAggregateInputType`](UsersAvgAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:37466

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to average

***

### \_count?

> `optional` **\_count?**: `true` \| [`UsersCountAggregateInputType`](UsersCountAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:37460

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Count returned users

***

### \_max?

> `optional` **\_max?**: [`UsersMaxAggregateInputType`](UsersMaxAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:37484

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the maximum value

***

### \_min?

> `optional` **\_min?**: [`UsersMinAggregateInputType`](UsersMinAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:37478

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the minimum value

***

### \_sum?

> `optional` **\_sum?**: [`UsersSumAggregateInputType`](UsersSumAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:37472

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to sum

***

### cursor?

> `optional` **cursor?**: [`usersWhereUniqueInput`](usersWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:37442

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the start position

***

### orderBy?

> `optional` **orderBy?**: [`usersOrderByWithRelationInput`](usersOrderByWithRelationInput.md) \| [`usersOrderByWithRelationInput`](usersOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:37436

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of users to fetch.

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:37454

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` users.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:37448

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` users from the position of the cursor.

***

### where?

> `optional` **where?**: [`usersWhereInput`](usersWhereInput.md)

Defined in: generated/prisma/index.d.ts:37430

Filter which users to aggregate.
