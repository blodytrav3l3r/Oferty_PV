[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_config\_historyFindManyArgs

# Type Alias: ai\_config\_historyFindManyArgs\<ExtArgs\>

> **ai\_config\_historyFindManyArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:7493

ai_config_history findMany

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`ai_config_historyWhereUniqueInput`](ai_config_historyWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:7517

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for listing ai_config_histories.

***

### distinct?

> `optional` **distinct?**: [`Ai_config_historyScalarFieldEnum`](Ai_config_historyScalarFieldEnum.md) \| [`Ai_config_historyScalarFieldEnum`](Ai_config_historyScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:7530

***

### omit?

> `optional` **omit?**: [`ai_config_historyOmit`](ai_config_historyOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:7501

Omit specific fields from the ai_config_history

***

### orderBy?

> `optional` **orderBy?**: [`ai_config_historyOrderByWithRelationInput`](ai_config_historyOrderByWithRelationInput.md) \| [`ai_config_historyOrderByWithRelationInput`](ai_config_historyOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:7511

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of ai_config_histories to fetch.

***

### select?

> `optional` **select?**: [`ai_config_historySelect`](ai_config_historySelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:7497

Select specific fields to fetch from the ai_config_history

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:7529

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` ai_config_histories.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:7523

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` ai_config_histories from the position of the cursor.

***

### where?

> `optional` **where?**: [`ai_config_historyWhereInput`](ai_config_historyWhereInput.md)

Defined in: generated/prisma/index.d.ts:7505

Filter, which ai_config_histories to fetch.
