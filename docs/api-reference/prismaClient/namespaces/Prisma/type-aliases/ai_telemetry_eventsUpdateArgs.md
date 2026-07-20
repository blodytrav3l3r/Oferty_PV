[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_telemetry\_eventsUpdateArgs

# Type Alias: ai\_telemetry\_eventsUpdateArgs\<ExtArgs\>

> **ai\_telemetry\_eventsUpdateArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:6460

ai_telemetry_events update

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`ai_telemetry_eventsUpdateInput`](ai_telemetry_eventsUpdateInput.md), [`ai_telemetry_eventsUncheckedUpdateInput`](ai_telemetry_eventsUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:6472

The data needed to update a ai_telemetry_events.

***

### omit?

> `optional` **omit?**: [`ai_telemetry_eventsOmit`](ai_telemetry_eventsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:6468

Omit specific fields from the ai_telemetry_events

***

### select?

> `optional` **select?**: [`ai_telemetry_eventsSelect`](ai_telemetry_eventsSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:6464

Select specific fields to fetch from the ai_telemetry_events

***

### where

> **where**: [`ai_telemetry_eventsWhereUniqueInput`](ai_telemetry_eventsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:6476

Choose, which ai_telemetry_events to update.
