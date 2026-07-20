[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_knowledge\_baseFindFirstOrThrowArgs

# Type Alias: ai\_knowledge\_baseFindFirstOrThrowArgs\<ExtArgs\>

> **ai\_knowledge\_baseFindFirstOrThrowArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:9685

ai_knowledge_base findFirstOrThrow

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`ai_knowledge_baseWhereUniqueInput`](ai_knowledge_baseWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:9709

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for ai_knowledge_bases.

***

### distinct?

> `optional` **distinct?**: [`Ai_knowledge_baseScalarFieldEnum`](Ai_knowledge_baseScalarFieldEnum.md) \| [`Ai_knowledge_baseScalarFieldEnum`](Ai_knowledge_baseScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:9727

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of ai_knowledge_bases.

***

### omit?

> `optional` **omit?**: [`ai_knowledge_baseOmit`](ai_knowledge_baseOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:9693

Omit specific fields from the ai_knowledge_base

***

### orderBy?

> `optional` **orderBy?**: [`ai_knowledge_baseOrderByWithRelationInput`](ai_knowledge_baseOrderByWithRelationInput.md) \| [`ai_knowledge_baseOrderByWithRelationInput`](ai_knowledge_baseOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:9703

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of ai_knowledge_bases to fetch.

***

### select?

> `optional` **select?**: [`ai_knowledge_baseSelect`](ai_knowledge_baseSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:9689

Select specific fields to fetch from the ai_knowledge_base

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:9721

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` ai_knowledge_bases.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:9715

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` ai_knowledge_bases from the position of the cursor.

***

### where?

> `optional` **where?**: [`ai_knowledge_baseWhereInput`](ai_knowledge_baseWhereInput.md)

Defined in: generated/prisma/index.d.ts:9697

Filter, which ai_knowledge_base to fetch.
