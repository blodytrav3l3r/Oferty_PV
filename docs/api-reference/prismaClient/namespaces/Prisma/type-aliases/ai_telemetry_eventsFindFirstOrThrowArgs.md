[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_telemetry\_eventsFindFirstOrThrowArgs

# Type Alias: ai\_telemetry\_eventsFindFirstOrThrowArgs\<ExtArgs\>

> **ai\_telemetry\_eventsFindFirstOrThrowArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:6323

ai_telemetry_events findFirstOrThrow

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`ai_telemetry_eventsWhereUniqueInput`](ai_telemetry_eventsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:6347

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for ai_telemetry_events.

***

### distinct?

> `optional` **distinct?**: [`Ai_telemetry_eventsScalarFieldEnum`](Ai_telemetry_eventsScalarFieldEnum.md) \| [`Ai_telemetry_eventsScalarFieldEnum`](Ai_telemetry_eventsScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:6365

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of ai_telemetry_events.

***

### omit?

> `optional` **omit?**: [`ai_telemetry_eventsOmit`](ai_telemetry_eventsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:6331

Omit specific fields from the ai_telemetry_events

***

### orderBy?

> `optional` **orderBy?**: [`ai_telemetry_eventsOrderByWithRelationInput`](ai_telemetry_eventsOrderByWithRelationInput.md) \| [`ai_telemetry_eventsOrderByWithRelationInput`](ai_telemetry_eventsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:6341

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of ai_telemetry_events to fetch.

***

### select?

> `optional` **select?**: [`ai_telemetry_eventsSelect`](ai_telemetry_eventsSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:6327

Select specific fields to fetch from the ai_telemetry_events

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:6359

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` ai_telemetry_events.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:6353

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` ai_telemetry_events from the position of the cursor.

***

### where?

> `optional` **where?**: [`ai_telemetry_eventsWhereInput`](ai_telemetry_eventsWhereInput.md)

Defined in: generated/prisma/index.d.ts:6335

Filter, which ai_telemetry_events to fetch.
