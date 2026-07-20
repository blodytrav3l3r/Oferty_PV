[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / production\_orders\_relFindFirstArgs

# Type Alias: production\_orders\_relFindFirstArgs\<ExtArgs\>

> **production\_orders\_relFindFirstArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:24577

production_orders_rel findFirst

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`production_orders_relWhereUniqueInput`](production_orders_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:24601

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for production_orders_rels.

---

### distinct?

> `optional` **distinct?**: [`Production_orders_relScalarFieldEnum`](Production_orders_relScalarFieldEnum.md) \| [`Production_orders_relScalarFieldEnum`](Production_orders_relScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:24619

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of production_orders_rels.

---

### omit?

> `optional` **omit?**: [`production_orders_relOmit`](production_orders_relOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:24585

Omit specific fields from the production_orders_rel

---

### orderBy?

> `optional` **orderBy?**: [`production_orders_relOrderByWithRelationInput`](production_orders_relOrderByWithRelationInput.md) \| [`production_orders_relOrderByWithRelationInput`](production_orders_relOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:24595

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of production_orders_rels to fetch.

---

### select?

> `optional` **select?**: [`production_orders_relSelect`](production_orders_relSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:24581

Select specific fields to fetch from the production_orders_rel

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:24613

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` production_orders_rels.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:24607

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` production_orders_rels from the position of the cursor.

---

### where?

> `optional` **where?**: [`production_orders_relWhereInput`](production_orders_relWhereInput.md)

Defined in: generated/prisma/index.d.ts:24589

Filter, which production_orders_rel to fetch.
