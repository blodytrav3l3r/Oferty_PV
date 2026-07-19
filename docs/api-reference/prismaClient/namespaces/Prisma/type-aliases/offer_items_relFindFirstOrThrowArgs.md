[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / offer\_items\_relFindFirstOrThrowArgs

# Type Alias: offer\_items\_relFindFirstOrThrowArgs\<ExtArgs\>

> **offer\_items\_relFindFirstOrThrowArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:15196

offer_items_rel findFirstOrThrow

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`offer_items_relWhereUniqueInput`](offer_items_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:15220

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for offer_items_rels.

---

### distinct?

> `optional` **distinct?**: [`Offer_items_relScalarFieldEnum`](Offer_items_relScalarFieldEnum.md) \| [`Offer_items_relScalarFieldEnum`](Offer_items_relScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:15238

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of offer_items_rels.

---

### omit?

> `optional` **omit?**: [`offer_items_relOmit`](offer_items_relOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:15204

Omit specific fields from the offer_items_rel

---

### orderBy?

> `optional` **orderBy?**: [`offer_items_relOrderByWithRelationInput`](offer_items_relOrderByWithRelationInput.md) \| [`offer_items_relOrderByWithRelationInput`](offer_items_relOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:15214

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of offer_items_rels to fetch.

---

### select?

> `optional` **select?**: [`offer_items_relSelect`](offer_items_relSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:15200

Select specific fields to fetch from the offer_items_rel

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:15232

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` offer_items_rels.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:15226

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` offer_items_rels from the position of the cursor.

---

### where?

> `optional` **where?**: [`offer_items_relWhereInput`](offer_items_relWhereInput.md)

Defined in: generated/prisma/index.d.ts:15208

Filter, which offer_items_rel to fetch.
