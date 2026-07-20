[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / SettingsAggregateArgs

# Type Alias: SettingsAggregateArgs\<ExtArgs\>

> **SettingsAggregateArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:26947

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### \_count?

> `optional` **\_count?**: `true` \| [`SettingsCountAggregateInputType`](SettingsCountAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:26981

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Count returned settings

***

### \_max?

> `optional` **\_max?**: [`SettingsMaxAggregateInputType`](SettingsMaxAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:26993

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the maximum value

***

### \_min?

> `optional` **\_min?**: [`SettingsMinAggregateInputType`](SettingsMinAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:26987

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the minimum value

***

### cursor?

> `optional` **cursor?**: [`settingsWhereUniqueInput`](settingsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:26963

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the start position

***

### orderBy?

> `optional` **orderBy?**: [`settingsOrderByWithRelationInput`](settingsOrderByWithRelationInput.md) \| [`settingsOrderByWithRelationInput`](settingsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:26957

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of settings to fetch.

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:26975

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` settings.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:26969

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` settings from the position of the cursor.

***

### where?

> `optional` **where?**: [`settingsWhereInput`](settingsWhereInput.md)

Defined in: generated/prisma/index.d.ts:26951

Filter which settings to aggregate.
