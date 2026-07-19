[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / offers\_relFindFirstOrThrowArgs

# Type Alias: offers\_relFindFirstOrThrowArgs\<ExtArgs\>

> **offers\_relFindFirstOrThrowArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:17388

offers_rel findFirstOrThrow

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`offers_relWhereUniqueInput`](offers_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:17412

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for offers_rels.

---

### distinct?

> `optional` **distinct?**: [`Offers_relScalarFieldEnum`](Offers_relScalarFieldEnum.md) \| [`Offers_relScalarFieldEnum`](Offers_relScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:17430

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of offers_rels.

---

### omit?

> `optional` **omit?**: [`offers_relOmit`](offers_relOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:17396

Omit specific fields from the offers_rel

---

### orderBy?

> `optional` **orderBy?**: [`offers_relOrderByWithRelationInput`](offers_relOrderByWithRelationInput.md) \| [`offers_relOrderByWithRelationInput`](offers_relOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:17406

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of offers_rels to fetch.

---

### select?

> `optional` **select?**: [`offers_relSelect`](offers_relSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:17392

Select specific fields to fetch from the offers_rel

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:17424

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` offers_rels.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:17418

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` offers_rels from the position of the cursor.

---

### where?

> `optional` **where?**: [`offers_relWhereInput`](offers_relWhereInput.md)

Defined in: generated/prisma/index.d.ts:17400

Filter, which offers_rel to fetch.
