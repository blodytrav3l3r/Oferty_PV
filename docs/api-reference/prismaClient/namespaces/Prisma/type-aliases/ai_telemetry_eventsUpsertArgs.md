[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_telemetry\_eventsUpsertArgs

# Type Alias: ai\_telemetry\_eventsUpsertArgs\<ExtArgs\>

> **ai\_telemetry\_eventsUpsertArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:6526

ai_telemetry_events upsert

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`ai_telemetry_eventsCreateInput`](ai_telemetry_eventsCreateInput.md), [`ai_telemetry_eventsUncheckedCreateInput`](ai_telemetry_eventsUncheckedCreateInput.md)\>

Defined in: generated/prisma/index.d.ts:6542

In case the ai_telemetry_events found by the `where` argument doesn't exist, create a new ai_telemetry_events with this data.

***

### omit?

> `optional` **omit?**: [`ai_telemetry_eventsOmit`](ai_telemetry_eventsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:6534

Omit specific fields from the ai_telemetry_events

***

### select?

> `optional` **select?**: [`ai_telemetry_eventsSelect`](ai_telemetry_eventsSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:6530

Select specific fields to fetch from the ai_telemetry_events

***

### update

> **update**: [`XOR`](XOR.md)\<[`ai_telemetry_eventsUpdateInput`](ai_telemetry_eventsUpdateInput.md), [`ai_telemetry_eventsUncheckedUpdateInput`](ai_telemetry_eventsUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:6546

In case the ai_telemetry_events was found with the provided `where` argument, update it with this data.

***

### where

> **where**: [`ai_telemetry_eventsWhereUniqueInput`](ai_telemetry_eventsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:6538

The filter to search for the ai_telemetry_events to update in case it exists.
