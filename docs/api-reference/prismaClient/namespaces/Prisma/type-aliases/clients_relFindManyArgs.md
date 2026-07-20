[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / clients\_relFindManyArgs

# Type Alias: clients\_relFindManyArgs\<ExtArgs\>

> **clients\_relFindManyArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:14196

clients_rel findMany

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`clients_relWhereUniqueInput`](clients_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:14220

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for listing clients_rels.

***

### distinct?

> `optional` **distinct?**: [`Clients_relScalarFieldEnum`](Clients_relScalarFieldEnum.md) \| [`Clients_relScalarFieldEnum`](Clients_relScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:14233

***

### omit?

> `optional` **omit?**: [`clients_relOmit`](clients_relOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:14204

Omit specific fields from the clients_rel

***

### orderBy?

> `optional` **orderBy?**: [`clients_relOrderByWithRelationInput`](clients_relOrderByWithRelationInput.md) \| [`clients_relOrderByWithRelationInput`](clients_relOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:14214

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of clients_rels to fetch.

***

### select?

> `optional` **select?**: [`clients_relSelect`](clients_relSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:14200

Select specific fields to fetch from the clients_rel

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:14232

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` clients_rels.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:14226

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` clients_rels from the position of the cursor.

***

### where?

> `optional` **where?**: [`clients_relWhereInput`](clients_relWhereInput.md)

Defined in: generated/prisma/index.d.ts:14208

Filter, which clients_rels to fetch.
