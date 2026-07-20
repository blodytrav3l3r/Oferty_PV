[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_recommendationsFindFirstArgs

# Type Alias: ai\_recommendationsFindFirstArgs\<ExtArgs\>

> **ai\_recommendationsFindFirstArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:10785

ai_recommendations findFirst

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`ai_recommendationsWhereUniqueInput`](ai_recommendationsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:10809

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for ai_recommendations.

***

### distinct?

> `optional` **distinct?**: [`Ai_recommendationsScalarFieldEnum`](Ai_recommendationsScalarFieldEnum.md) \| [`Ai_recommendationsScalarFieldEnum`](Ai_recommendationsScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:10827

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of ai_recommendations.

***

### omit?

> `optional` **omit?**: [`ai_recommendationsOmit`](ai_recommendationsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:10793

Omit specific fields from the ai_recommendations

***

### orderBy?

> `optional` **orderBy?**: [`ai_recommendationsOrderByWithRelationInput`](ai_recommendationsOrderByWithRelationInput.md) \| [`ai_recommendationsOrderByWithRelationInput`](ai_recommendationsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:10803

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of ai_recommendations to fetch.

***

### select?

> `optional` **select?**: [`ai_recommendationsSelect`](ai_recommendationsSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:10789

Select specific fields to fetch from the ai_recommendations

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:10821

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` ai_recommendations.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:10815

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` ai_recommendations from the position of the cursor.

***

### where?

> `optional` **where?**: [`ai_recommendationsWhereInput`](ai_recommendationsWhereInput.md)

Defined in: generated/prisma/index.d.ts:10797

Filter, which ai_recommendations to fetch.
