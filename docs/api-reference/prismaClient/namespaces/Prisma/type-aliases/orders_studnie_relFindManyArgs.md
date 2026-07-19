[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / orders\_studnie\_relFindManyArgs

# Type Alias: orders\_studnie\_relFindManyArgs\<ExtArgs\>

> **orders\_studnie\_relFindManyArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:21583

orders_studnie_rel findMany

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`orders_studnie_relWhereUniqueInput`](orders_studnie_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:21607

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for listing orders_studnie_rels.

---

### distinct?

> `optional` **distinct?**: [`Orders_studnie_relScalarFieldEnum`](Orders_studnie_relScalarFieldEnum.md) \| [`Orders_studnie_relScalarFieldEnum`](Orders_studnie_relScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:21620

---

### omit?

> `optional` **omit?**: [`orders_studnie_relOmit`](orders_studnie_relOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:21591

Omit specific fields from the orders_studnie_rel

---

### orderBy?

> `optional` **orderBy?**: [`orders_studnie_relOrderByWithRelationInput`](orders_studnie_relOrderByWithRelationInput.md) \| [`orders_studnie_relOrderByWithRelationInput`](orders_studnie_relOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:21601

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of orders_studnie_rels to fetch.

---

### select?

> `optional` **select?**: [`orders_studnie_relSelect`](orders_studnie_relSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:21587

Select specific fields to fetch from the orders_studnie_rel

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:21619

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` orders_studnie_rels.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:21613

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` orders_studnie_rels from the position of the cursor.

---

### where?

> `optional` **where?**: [`orders_studnie_relWhereInput`](orders_studnie_relWhereInput.md)

Defined in: generated/prisma/index.d.ts:21595

Filter, which orders_studnie_rels to fetch.
