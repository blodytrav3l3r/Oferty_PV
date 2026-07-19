[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / Audit\_logsAggregateArgs

# Type Alias: Audit\_logsAggregateArgs\<ExtArgs\>

> **Audit\_logsAggregateArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:12397

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### \_count?

> `optional` **\_count?**: `true` \| [`Audit_logsCountAggregateInputType`](Audit_logsCountAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:12431

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Count returned audit_logs

---

### \_max?

> `optional` **\_max?**: [`Audit_logsMaxAggregateInputType`](Audit_logsMaxAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:12443

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the maximum value

---

### \_min?

> `optional` **\_min?**: [`Audit_logsMinAggregateInputType`](Audit_logsMinAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:12437

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the minimum value

---

### cursor?

> `optional` **cursor?**: [`audit_logsWhereUniqueInput`](audit_logsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:12413

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the start position

---

### orderBy?

> `optional` **orderBy?**: [`audit_logsOrderByWithRelationInput`](audit_logsOrderByWithRelationInput.md) \| [`audit_logsOrderByWithRelationInput`](audit_logsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:12407

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of audit_logs to fetch.

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:12425

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` audit_logs.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:12419

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` audit_logs from the position of the cursor.

---

### where?

> `optional` **where?**: [`audit_logsWhereInput`](audit_logsWhereInput.md)

Defined in: generated/prisma/index.d.ts:12401

Filter which audit_logs to aggregate.
