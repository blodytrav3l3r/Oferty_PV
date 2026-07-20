[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / Ai\_telemetry\_logsAggregateArgs

# Type Alias: Ai\_telemetry\_logsAggregateArgs\<ExtArgs\>

> **Ai\_telemetry\_logsAggregateArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:4124

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### \_avg?

> `optional` **\_avg?**: [`Ai_telemetry_logsAvgAggregateInputType`](Ai_telemetry_logsAvgAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:4164

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to average

---

### \_count?

> `optional` **\_count?**: `true` \| [`Ai_telemetry_logsCountAggregateInputType`](Ai_telemetry_logsCountAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:4158

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Count returned ai_telemetry_logs

---

### \_max?

> `optional` **\_max?**: [`Ai_telemetry_logsMaxAggregateInputType`](Ai_telemetry_logsMaxAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:4182

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the maximum value

---

### \_min?

> `optional` **\_min?**: [`Ai_telemetry_logsMinAggregateInputType`](Ai_telemetry_logsMinAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:4176

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the minimum value

---

### \_sum?

> `optional` **\_sum?**: [`Ai_telemetry_logsSumAggregateInputType`](Ai_telemetry_logsSumAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:4170

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to sum

---

### cursor?

> `optional` **cursor?**: [`ai_telemetry_logsWhereUniqueInput`](ai_telemetry_logsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:4140

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the start position

---

### orderBy?

> `optional` **orderBy?**: [`ai_telemetry_logsOrderByWithRelationInput`](ai_telemetry_logsOrderByWithRelationInput.md) \| [`ai_telemetry_logsOrderByWithRelationInput`](ai_telemetry_logsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:4134

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of ai_telemetry_logs to fetch.

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:4152

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` ai_telemetry_logs.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:4146

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` ai_telemetry_logs from the position of the cursor.

---

### where?

> `optional` **where?**: [`ai_telemetry_logsWhereInput`](ai_telemetry_logsWhereInput.md)

Defined in: generated/prisma/index.d.ts:4128

Filter which ai_telemetry_logs to aggregate.
