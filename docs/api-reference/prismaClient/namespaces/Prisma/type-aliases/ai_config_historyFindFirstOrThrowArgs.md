[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_config\_historyFindFirstOrThrowArgs

# Type Alias: ai\_config\_historyFindFirstOrThrowArgs\<ExtArgs\>

> **ai\_config\_historyFindFirstOrThrowArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:7445

ai_config_history findFirstOrThrow

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`ai_config_historyWhereUniqueInput`](ai_config_historyWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:7469

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for ai_config_histories.

***

### distinct?

> `optional` **distinct?**: [`Ai_config_historyScalarFieldEnum`](Ai_config_historyScalarFieldEnum.md) \| [`Ai_config_historyScalarFieldEnum`](Ai_config_historyScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:7487

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of ai_config_histories.

***

### omit?

> `optional` **omit?**: [`ai_config_historyOmit`](ai_config_historyOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:7453

Omit specific fields from the ai_config_history

***

### orderBy?

> `optional` **orderBy?**: [`ai_config_historyOrderByWithRelationInput`](ai_config_historyOrderByWithRelationInput.md) \| [`ai_config_historyOrderByWithRelationInput`](ai_config_historyOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:7463

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of ai_config_histories to fetch.

***

### select?

> `optional` **select?**: [`ai_config_historySelect`](ai_config_historySelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:7449

Select specific fields to fetch from the ai_config_history

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:7481

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` ai_config_histories.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:7475

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` ai_config_histories from the position of the cursor.

***

### where?

> `optional` **where?**: [`ai_config_historyWhereInput`](ai_config_historyWhereInput.md)

Defined in: generated/prisma/index.d.ts:7457

Filter, which ai_config_history to fetch.
