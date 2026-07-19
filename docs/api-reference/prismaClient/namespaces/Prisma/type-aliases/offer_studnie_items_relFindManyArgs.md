[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / offer\_studnie\_items\_relFindManyArgs

# Type Alias: offer\_studnie\_items\_relFindManyArgs\<ExtArgs\>

> **offer\_studnie\_items\_relFindManyArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:16305

offer_studnie_items_rel findMany

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`offer_studnie_items_relWhereUniqueInput`](offer_studnie_items_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:16329

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for listing offer_studnie_items_rels.

---

### distinct?

> `optional` **distinct?**: [`Offer_studnie_items_relScalarFieldEnum`](Offer_studnie_items_relScalarFieldEnum.md) \| [`Offer_studnie_items_relScalarFieldEnum`](Offer_studnie_items_relScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:16342

---

### omit?

> `optional` **omit?**: [`offer_studnie_items_relOmit`](offer_studnie_items_relOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:16313

Omit specific fields from the offer_studnie_items_rel

---

### orderBy?

> `optional` **orderBy?**: [`offer_studnie_items_relOrderByWithRelationInput`](offer_studnie_items_relOrderByWithRelationInput.md) \| [`offer_studnie_items_relOrderByWithRelationInput`](offer_studnie_items_relOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:16323

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of offer_studnie_items_rels to fetch.

---

### select?

> `optional` **select?**: [`offer_studnie_items_relSelect`](offer_studnie_items_relSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:16309

Select specific fields to fetch from the offer_studnie_items_rel

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:16341

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` offer_studnie_items_rels.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:16335

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` offer_studnie_items_rels from the position of the cursor.

---

### where?

> `optional` **where?**: [`offer_studnie_items_relWhereInput`](offer_studnie_items_relWhereInput.md)

Defined in: generated/prisma/index.d.ts:16317

Filter, which offer_studnie_items_rels to fetch.
