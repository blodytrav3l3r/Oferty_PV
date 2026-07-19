[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / CategoriesStudnieFindFirstOrThrowArgs

# Type Alias: CategoriesStudnieFindFirstOrThrowArgs\<ExtArgs\>

> **CategoriesStudnieFindFirstOrThrowArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:30800

CategoriesStudnie findFirstOrThrow

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`CategoriesStudnieWhereUniqueInput`](CategoriesStudnieWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:30828

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for CategoriesStudnies.

---

### distinct?

> `optional` **distinct?**: [`CategoriesStudnieScalarFieldEnum`](CategoriesStudnieScalarFieldEnum.md) \| [`CategoriesStudnieScalarFieldEnum`](CategoriesStudnieScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:30846

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of CategoriesStudnies.

---

### include?

> `optional` **include?**: [`CategoriesStudnieInclude`](CategoriesStudnieInclude.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:30812

Choose, which related nodes to fetch as well

---

### omit?

> `optional` **omit?**: [`CategoriesStudnieOmit`](CategoriesStudnieOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:30808

Omit specific fields from the CategoriesStudnie

---

### orderBy?

> `optional` **orderBy?**: [`CategoriesStudnieOrderByWithRelationInput`](CategoriesStudnieOrderByWithRelationInput.md) \| [`CategoriesStudnieOrderByWithRelationInput`](CategoriesStudnieOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:30822

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of CategoriesStudnies to fetch.

---

### select?

> `optional` **select?**: [`CategoriesStudnieSelect`](CategoriesStudnieSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:30804

Select specific fields to fetch from the CategoriesStudnie

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:30840

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` CategoriesStudnies.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:30834

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` CategoriesStudnies from the position of the cursor.

---

### where?

> `optional` **where?**: [`CategoriesStudnieWhereInput`](CategoriesStudnieWhereInput.md)

Defined in: generated/prisma/index.d.ts:30816

Filter, which CategoriesStudnie to fetch.
