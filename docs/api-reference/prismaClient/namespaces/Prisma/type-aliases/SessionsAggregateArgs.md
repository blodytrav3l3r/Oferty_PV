[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / SessionsAggregateArgs

# Type Alias: SessionsAggregateArgs\<ExtArgs\>

> **SessionsAggregateArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:25970

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### \_avg?

> `optional` **\_avg?**: [`SessionsAvgAggregateInputType`](SessionsAvgAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:26010

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to average

---

### \_count?

> `optional` **\_count?**: `true` \| [`SessionsCountAggregateInputType`](SessionsCountAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:26004

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Count returned sessions

---

### \_max?

> `optional` **\_max?**: [`SessionsMaxAggregateInputType`](SessionsMaxAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:26028

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the maximum value

---

### \_min?

> `optional` **\_min?**: [`SessionsMinAggregateInputType`](SessionsMinAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:26022

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the minimum value

---

### \_sum?

> `optional` **\_sum?**: [`SessionsSumAggregateInputType`](SessionsSumAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:26016

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to sum

---

### cursor?

> `optional` **cursor?**: [`sessionsWhereUniqueInput`](sessionsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:25986

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the start position

---

### orderBy?

> `optional` **orderBy?**: [`sessionsOrderByWithRelationInput`](sessionsOrderByWithRelationInput.md) \| [`sessionsOrderByWithRelationInput`](sessionsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:25980

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of sessions to fetch.

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:25998

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` sessions.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:25992

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` sessions from the position of the cursor.

---

### where?

> `optional` **where?**: [`sessionsWhereInput`](sessionsWhereInput.md)

Defined in: generated/prisma/index.d.ts:25974

Filter which sessions to aggregate.
