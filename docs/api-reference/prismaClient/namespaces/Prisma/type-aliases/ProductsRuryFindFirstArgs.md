[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ProductsRuryFindFirstArgs

# Type Alias: ProductsRuryFindFirstArgs\<ExtArgs\>

> **ProductsRuryFindFirstArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:29688

ProductsRury findFirst

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`ProductsRuryWhereUniqueInput`](ProductsRuryWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:29716

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for ProductsRuries.

---

### distinct?

> `optional` **distinct?**: [`ProductsRuryScalarFieldEnum`](ProductsRuryScalarFieldEnum.md) \| [`ProductsRuryScalarFieldEnum`](ProductsRuryScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:29734

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of ProductsRuries.

---

### include?

> `optional` **include?**: [`ProductsRuryInclude`](ProductsRuryInclude.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:29700

Choose, which related nodes to fetch as well

---

### omit?

> `optional` **omit?**: [`ProductsRuryOmit`](ProductsRuryOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:29696

Omit specific fields from the ProductsRury

---

### orderBy?

> `optional` **orderBy?**: [`ProductsRuryOrderByWithRelationInput`](ProductsRuryOrderByWithRelationInput.md) \| [`ProductsRuryOrderByWithRelationInput`](ProductsRuryOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:29710

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of ProductsRuries to fetch.

---

### select?

> `optional` **select?**: [`ProductsRurySelect`](ProductsRurySelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:29692

Select specific fields to fetch from the ProductsRury

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:29728

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` ProductsRuries.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:29722

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` ProductsRuries from the position of the cursor.

---

### where?

> `optional` **where?**: [`ProductsRuryWhereInput`](ProductsRuryWhereInput.md)

Defined in: generated/prisma/index.d.ts:29704

Filter, which ProductsRury to fetch.
