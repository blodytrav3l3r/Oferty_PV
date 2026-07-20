[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / clients\_relFindFirstArgs

# Type Alias: clients\_relFindFirstArgs\<ExtArgs\>

> **clients\_relFindFirstArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:14100

clients_rel findFirst

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`clients_relWhereUniqueInput`](clients_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:14124

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for clients_rels.

***

### distinct?

> `optional` **distinct?**: [`Clients_relScalarFieldEnum`](Clients_relScalarFieldEnum.md) \| [`Clients_relScalarFieldEnum`](Clients_relScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:14142

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of clients_rels.

***

### omit?

> `optional` **omit?**: [`clients_relOmit`](clients_relOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:14108

Omit specific fields from the clients_rel

***

### orderBy?

> `optional` **orderBy?**: [`clients_relOrderByWithRelationInput`](clients_relOrderByWithRelationInput.md) \| [`clients_relOrderByWithRelationInput`](clients_relOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:14118

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of clients_rels to fetch.

***

### select?

> `optional` **select?**: [`clients_relSelect`](clients_relSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:14104

Select specific fields to fetch from the clients_rel

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:14136

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` clients_rels.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:14130

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` clients_rels from the position of the cursor.

***

### where?

> `optional` **where?**: [`clients_relWhereInput`](clients_relWhereInput.md)

Defined in: generated/prisma/index.d.ts:14112

Filter, which clients_rel to fetch.
