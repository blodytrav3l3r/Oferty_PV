[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / CategoriesStudnieFindManyArgs

# Type Alias: CategoriesStudnieFindManyArgs\<ExtArgs\>

> **CategoriesStudnieFindManyArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:30852

CategoriesStudnie findMany

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`CategoriesStudnieWhereUniqueInput`](CategoriesStudnieWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:30880

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for listing CategoriesStudnies.

***

### distinct?

> `optional` **distinct?**: [`CategoriesStudnieScalarFieldEnum`](CategoriesStudnieScalarFieldEnum.md) \| [`CategoriesStudnieScalarFieldEnum`](CategoriesStudnieScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:30893

***

### include?

> `optional` **include?**: [`CategoriesStudnieInclude`](CategoriesStudnieInclude.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:30864

Choose, which related nodes to fetch as well

***

### omit?

> `optional` **omit?**: [`CategoriesStudnieOmit`](CategoriesStudnieOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:30860

Omit specific fields from the CategoriesStudnie

***

### orderBy?

> `optional` **orderBy?**: [`CategoriesStudnieOrderByWithRelationInput`](CategoriesStudnieOrderByWithRelationInput.md) \| [`CategoriesStudnieOrderByWithRelationInput`](CategoriesStudnieOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:30874

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of CategoriesStudnies to fetch.

***

### select?

> `optional` **select?**: [`CategoriesStudnieSelect`](CategoriesStudnieSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:30856

Select specific fields to fetch from the CategoriesStudnie

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:30892

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` CategoriesStudnies.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:30886

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` CategoriesStudnies from the position of the cursor.

***

### where?

> `optional` **where?**: [`CategoriesStudnieWhereInput`](CategoriesStudnieWhereInput.md)

Defined in: generated/prisma/index.d.ts:30868

Filter, which CategoriesStudnies to fetch.
