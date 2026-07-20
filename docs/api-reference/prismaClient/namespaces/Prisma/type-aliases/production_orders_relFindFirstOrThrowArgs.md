[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / production\_orders\_relFindFirstOrThrowArgs

# Type Alias: production\_orders\_relFindFirstOrThrowArgs\<ExtArgs\>

> **production\_orders\_relFindFirstOrThrowArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:24625

production_orders_rel findFirstOrThrow

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`production_orders_relWhereUniqueInput`](production_orders_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:24649

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for production_orders_rels.

***

### distinct?

> `optional` **distinct?**: [`Production_orders_relScalarFieldEnum`](Production_orders_relScalarFieldEnum.md) \| [`Production_orders_relScalarFieldEnum`](Production_orders_relScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:24667

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of production_orders_rels.

***

### omit?

> `optional` **omit?**: [`production_orders_relOmit`](production_orders_relOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:24633

Omit specific fields from the production_orders_rel

***

### orderBy?

> `optional` **orderBy?**: [`production_orders_relOrderByWithRelationInput`](production_orders_relOrderByWithRelationInput.md) \| [`production_orders_relOrderByWithRelationInput`](production_orders_relOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:24643

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of production_orders_rels to fetch.

***

### select?

> `optional` **select?**: [`production_orders_relSelect`](production_orders_relSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:24629

Select specific fields to fetch from the production_orders_rel

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:24661

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` production_orders_rels.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:24655

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` production_orders_rels from the position of the cursor.

***

### where?

> `optional` **where?**: [`production_orders_relWhereInput`](production_orders_relWhereInput.md)

Defined in: generated/prisma/index.d.ts:24637

Filter, which production_orders_rel to fetch.
