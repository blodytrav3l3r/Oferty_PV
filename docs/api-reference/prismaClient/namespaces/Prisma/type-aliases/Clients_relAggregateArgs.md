[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / Clients\_relAggregateArgs

# Type Alias: Clients\_relAggregateArgs\<ExtArgs\>

> **Clients\_relAggregateArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:13447

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### \_count?

> `optional` **\_count?**: `true` \| [`Clients_relCountAggregateInputType`](Clients_relCountAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:13481

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Count returned clients_rels

---

### \_max?

> `optional` **\_max?**: [`Clients_relMaxAggregateInputType`](Clients_relMaxAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:13493

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the maximum value

---

### \_min?

> `optional` **\_min?**: [`Clients_relMinAggregateInputType`](Clients_relMinAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:13487

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the minimum value

---

### cursor?

> `optional` **cursor?**: [`clients_relWhereUniqueInput`](clients_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:13463

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the start position

---

### orderBy?

> `optional` **orderBy?**: [`clients_relOrderByWithRelationInput`](clients_relOrderByWithRelationInput.md) \| [`clients_relOrderByWithRelationInput`](clients_relOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:13457

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of clients_rels to fetch.

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:13475

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` clients_rels.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:13469

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` clients_rels from the position of the cursor.

---

### where?

> `optional` **where?**: [`clients_relWhereInput`](clients_relWhereInput.md)

Defined in: generated/prisma/index.d.ts:13451

Filter which clients_rel to aggregate.
