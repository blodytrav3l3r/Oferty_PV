[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_recommendationsFindManyArgs

# Type Alias: ai\_recommendationsFindManyArgs\<ExtArgs\>

> **ai\_recommendationsFindManyArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:10881

ai_recommendations findMany

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`ai_recommendationsWhereUniqueInput`](ai_recommendationsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:10905

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for listing ai_recommendations.

***

### distinct?

> `optional` **distinct?**: [`Ai_recommendationsScalarFieldEnum`](Ai_recommendationsScalarFieldEnum.md) \| [`Ai_recommendationsScalarFieldEnum`](Ai_recommendationsScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:10918

***

### omit?

> `optional` **omit?**: [`ai_recommendationsOmit`](ai_recommendationsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:10889

Omit specific fields from the ai_recommendations

***

### orderBy?

> `optional` **orderBy?**: [`ai_recommendationsOrderByWithRelationInput`](ai_recommendationsOrderByWithRelationInput.md) \| [`ai_recommendationsOrderByWithRelationInput`](ai_recommendationsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:10899

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of ai_recommendations to fetch.

***

### select?

> `optional` **select?**: [`ai_recommendationsSelect`](ai_recommendationsSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:10885

Select specific fields to fetch from the ai_recommendations

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:10917

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` ai_recommendations.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:10911

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` ai_recommendations from the position of the cursor.

***

### where?

> `optional` **where?**: [`ai_recommendationsWhereInput`](ai_recommendationsWhereInput.md)

Defined in: generated/prisma/index.d.ts:10893

Filter, which ai_recommendations to fetch.
