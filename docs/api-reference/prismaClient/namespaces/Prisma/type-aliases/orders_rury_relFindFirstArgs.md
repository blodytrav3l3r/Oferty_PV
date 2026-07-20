[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / orders\_rury\_relFindFirstArgs

# Type Alias: orders\_rury\_relFindFirstArgs\<ExtArgs\>

> **orders\_rury\_relFindFirstArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:22493

orders_rury_rel findFirst

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`orders_rury_relWhereUniqueInput`](orders_rury_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:22517

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for orders_rury_rels.

***

### distinct?

> `optional` **distinct?**: [`Orders_rury_relScalarFieldEnum`](Orders_rury_relScalarFieldEnum.md) \| [`Orders_rury_relScalarFieldEnum`](Orders_rury_relScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:22535

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of orders_rury_rels.

***

### omit?

> `optional` **omit?**: [`orders_rury_relOmit`](orders_rury_relOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:22501

Omit specific fields from the orders_rury_rel

***

### orderBy?

> `optional` **orderBy?**: [`orders_rury_relOrderByWithRelationInput`](orders_rury_relOrderByWithRelationInput.md) \| [`orders_rury_relOrderByWithRelationInput`](orders_rury_relOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:22511

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of orders_rury_rels to fetch.

***

### select?

> `optional` **select?**: [`orders_rury_relSelect`](orders_rury_relSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:22497

Select specific fields to fetch from the orders_rury_rel

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:22529

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` orders_rury_rels.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:22523

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` orders_rury_rels from the position of the cursor.

***

### where?

> `optional` **where?**: [`orders_rury_relWhereInput`](orders_rury_relWhereInput.md)

Defined in: generated/prisma/index.d.ts:22505

Filter, which orders_rury_rel to fetch.
