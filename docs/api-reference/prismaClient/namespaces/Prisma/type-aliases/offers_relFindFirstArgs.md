[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / offers\_relFindFirstArgs

# Type Alias: offers\_relFindFirstArgs\<ExtArgs\>

> **offers\_relFindFirstArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:17340

offers_rel findFirst

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`offers_relWhereUniqueInput`](offers_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:17364

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for offers_rels.

***

### distinct?

> `optional` **distinct?**: [`Offers_relScalarFieldEnum`](Offers_relScalarFieldEnum.md) \| [`Offers_relScalarFieldEnum`](Offers_relScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:17382

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of offers_rels.

***

### omit?

> `optional` **omit?**: [`offers_relOmit`](offers_relOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:17348

Omit specific fields from the offers_rel

***

### orderBy?

> `optional` **orderBy?**: [`offers_relOrderByWithRelationInput`](offers_relOrderByWithRelationInput.md) \| [`offers_relOrderByWithRelationInput`](offers_relOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:17358

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of offers_rels to fetch.

***

### select?

> `optional` **select?**: [`offers_relSelect`](offers_relSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:17344

Select specific fields to fetch from the offers_rel

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:17376

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` offers_rels.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:17370

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` offers_rels from the position of the cursor.

***

### where?

> `optional` **where?**: [`offers_relWhereInput`](offers_relWhereInput.md)

Defined in: generated/prisma/index.d.ts:17352

Filter, which offers_rel to fetch.
