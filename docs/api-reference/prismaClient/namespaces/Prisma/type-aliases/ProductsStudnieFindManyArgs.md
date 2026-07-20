[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ProductsStudnieFindManyArgs

# Type Alias: ProductsStudnieFindManyArgs\<ExtArgs\>

> **ProductsStudnieFindManyArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:32440

ProductsStudnie findMany

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`ProductsStudnieWhereUniqueInput`](ProductsStudnieWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:32468

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for listing ProductsStudnies.

---

### distinct?

> `optional` **distinct?**: [`ProductsStudnieScalarFieldEnum`](ProductsStudnieScalarFieldEnum.md) \| [`ProductsStudnieScalarFieldEnum`](ProductsStudnieScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:32481

---

### include?

> `optional` **include?**: [`ProductsStudnieInclude`](ProductsStudnieInclude.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:32452

Choose, which related nodes to fetch as well

---

### omit?

> `optional` **omit?**: [`ProductsStudnieOmit`](ProductsStudnieOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:32448

Omit specific fields from the ProductsStudnie

---

### orderBy?

> `optional` **orderBy?**: [`ProductsStudnieOrderByWithRelationInput`](ProductsStudnieOrderByWithRelationInput.md) \| [`ProductsStudnieOrderByWithRelationInput`](ProductsStudnieOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:32462

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of ProductsStudnies to fetch.

---

### select?

> `optional` **select?**: [`ProductsStudnieSelect`](ProductsStudnieSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:32444

Select specific fields to fetch from the ProductsStudnie

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:32480

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` ProductsStudnies.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:32474

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` ProductsStudnies from the position of the cursor.

---

### where?

> `optional` **where?**: [`ProductsStudnieWhereInput`](ProductsStudnieWhereInput.md)

Defined in: generated/prisma/index.d.ts:32456

Filter, which ProductsStudnies to fetch.
