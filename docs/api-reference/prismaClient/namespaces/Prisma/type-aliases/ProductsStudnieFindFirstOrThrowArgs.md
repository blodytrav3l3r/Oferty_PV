[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ProductsStudnieFindFirstOrThrowArgs

# Type Alias: ProductsStudnieFindFirstOrThrowArgs\<ExtArgs\>

> **ProductsStudnieFindFirstOrThrowArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:32388

ProductsStudnie findFirstOrThrow

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`ProductsStudnieWhereUniqueInput`](ProductsStudnieWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:32416

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for ProductsStudnies.

---

### distinct?

> `optional` **distinct?**: [`ProductsStudnieScalarFieldEnum`](ProductsStudnieScalarFieldEnum.md) \| [`ProductsStudnieScalarFieldEnum`](ProductsStudnieScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:32434

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of ProductsStudnies.

---

### include?

> `optional` **include?**: [`ProductsStudnieInclude`](ProductsStudnieInclude.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:32400

Choose, which related nodes to fetch as well

---

### omit?

> `optional` **omit?**: [`ProductsStudnieOmit`](ProductsStudnieOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:32396

Omit specific fields from the ProductsStudnie

---

### orderBy?

> `optional` **orderBy?**: [`ProductsStudnieOrderByWithRelationInput`](ProductsStudnieOrderByWithRelationInput.md) \| [`ProductsStudnieOrderByWithRelationInput`](ProductsStudnieOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:32410

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of ProductsStudnies to fetch.

---

### select?

> `optional` **select?**: [`ProductsStudnieSelect`](ProductsStudnieSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:32392

Select specific fields to fetch from the ProductsStudnie

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:32428

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` ProductsStudnies.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:32422

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` ProductsStudnies from the position of the cursor.

---

### where?

> `optional` **where?**: [`ProductsStudnieWhereInput`](ProductsStudnieWhereInput.md)

Defined in: generated/prisma/index.d.ts:32404

Filter, which ProductsStudnie to fetch.
