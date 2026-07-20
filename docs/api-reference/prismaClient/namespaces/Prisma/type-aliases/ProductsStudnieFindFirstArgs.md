[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ProductsStudnieFindFirstArgs

# Type Alias: ProductsStudnieFindFirstArgs\<ExtArgs\>

> **ProductsStudnieFindFirstArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:32336

ProductsStudnie findFirst

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`ProductsStudnieWhereUniqueInput`](ProductsStudnieWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:32364

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for ProductsStudnies.

***

### distinct?

> `optional` **distinct?**: [`ProductsStudnieScalarFieldEnum`](ProductsStudnieScalarFieldEnum.md) \| [`ProductsStudnieScalarFieldEnum`](ProductsStudnieScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:32382

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of ProductsStudnies.

***

### include?

> `optional` **include?**: [`ProductsStudnieInclude`](ProductsStudnieInclude.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:32348

Choose, which related nodes to fetch as well

***

### omit?

> `optional` **omit?**: [`ProductsStudnieOmit`](ProductsStudnieOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:32344

Omit specific fields from the ProductsStudnie

***

### orderBy?

> `optional` **orderBy?**: [`ProductsStudnieOrderByWithRelationInput`](ProductsStudnieOrderByWithRelationInput.md) \| [`ProductsStudnieOrderByWithRelationInput`](ProductsStudnieOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:32358

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of ProductsStudnies to fetch.

***

### select?

> `optional` **select?**: [`ProductsStudnieSelect`](ProductsStudnieSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:32340

Select specific fields to fetch from the ProductsStudnie

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:32376

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` ProductsStudnies.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:32370

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` ProductsStudnies from the position of the cursor.

***

### where?

> `optional` **where?**: [`ProductsStudnieWhereInput`](ProductsStudnieWhereInput.md)

Defined in: generated/prisma/index.d.ts:32352

Filter, which ProductsStudnie to fetch.
