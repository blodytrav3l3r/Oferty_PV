[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ProductsRuryFindManyArgs

# Type Alias: ProductsRuryFindManyArgs\<ExtArgs\>

> **ProductsRuryFindManyArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:29792

ProductsRury findMany

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`ProductsRuryWhereUniqueInput`](ProductsRuryWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:29820

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for listing ProductsRuries.

---

### distinct?

> `optional` **distinct?**: [`ProductsRuryScalarFieldEnum`](ProductsRuryScalarFieldEnum.md) \| [`ProductsRuryScalarFieldEnum`](ProductsRuryScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:29833

---

### include?

> `optional` **include?**: [`ProductsRuryInclude`](ProductsRuryInclude.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:29804

Choose, which related nodes to fetch as well

---

### omit?

> `optional` **omit?**: [`ProductsRuryOmit`](ProductsRuryOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:29800

Omit specific fields from the ProductsRury

---

### orderBy?

> `optional` **orderBy?**: [`ProductsRuryOrderByWithRelationInput`](ProductsRuryOrderByWithRelationInput.md) \| [`ProductsRuryOrderByWithRelationInput`](ProductsRuryOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:29814

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of ProductsRuries to fetch.

---

### select?

> `optional` **select?**: [`ProductsRurySelect`](ProductsRurySelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:29796

Select specific fields to fetch from the ProductsRury

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:29832

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` ProductsRuries.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:29826

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` ProductsRuries from the position of the cursor.

---

### where?

> `optional` **where?**: [`ProductsRuryWhereInput`](ProductsRuryWhereInput.md)

Defined in: generated/prisma/index.d.ts:29808

Filter, which ProductsRuries to fetch.
