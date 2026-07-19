[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / Ai\_telemetry\_eventsAggregateArgs

# Type Alias: Ai\_telemetry\_eventsAggregateArgs\<ExtArgs\>

> **Ai\_telemetry\_eventsAggregateArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:5592

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### \_avg?

> `optional` **\_avg?**: [`Ai_telemetry_eventsAvgAggregateInputType`](Ai_telemetry_eventsAvgAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:5632

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to average

---

### \_count?

> `optional` **\_count?**: `true` \| [`Ai_telemetry_eventsCountAggregateInputType`](Ai_telemetry_eventsCountAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:5626

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Count returned ai_telemetry_events

---

### \_max?

> `optional` **\_max?**: [`Ai_telemetry_eventsMaxAggregateInputType`](Ai_telemetry_eventsMaxAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:5650

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the maximum value

---

### \_min?

> `optional` **\_min?**: [`Ai_telemetry_eventsMinAggregateInputType`](Ai_telemetry_eventsMinAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:5644

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to find the minimum value

---

### \_sum?

> `optional` **\_sum?**: [`Ai_telemetry_eventsSumAggregateInputType`](Ai_telemetry_eventsSumAggregateInputType.md)

Defined in: generated/prisma/index.d.ts:5638

[Aggregation Docs](https://www.prisma.io/docs/concepts/components/prisma-client/aggregations)

Select which fields to sum

---

### cursor?

> `optional` **cursor?**: [`ai_telemetry_eventsWhereUniqueInput`](ai_telemetry_eventsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:5608

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the start position

---

### orderBy?

> `optional` **orderBy?**: [`ai_telemetry_eventsOrderByWithRelationInput`](ai_telemetry_eventsOrderByWithRelationInput.md) \| [`ai_telemetry_eventsOrderByWithRelationInput`](ai_telemetry_eventsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:5602

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of ai_telemetry_events to fetch.

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:5620

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` ai_telemetry_events.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:5614

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` ai_telemetry_events from the position of the cursor.

---

### where?

> `optional` **where?**: [`ai_telemetry_eventsWhereInput`](ai_telemetry_eventsWhereInput.md)

Defined in: generated/prisma/index.d.ts:5596

Filter which ai_telemetry_events to aggregate.
