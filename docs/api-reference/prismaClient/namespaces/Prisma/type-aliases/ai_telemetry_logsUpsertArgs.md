[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_telemetry\_logsUpsertArgs

# Type Alias: ai\_telemetry\_logsUpsertArgs\<ExtArgs\>

> **ai\_telemetry\_logsUpsertArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:5387

ai_telemetry_logs upsert

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`ai_telemetry_logsCreateInput`](ai_telemetry_logsCreateInput.md), [`ai_telemetry_logsUncheckedCreateInput`](ai_telemetry_logsUncheckedCreateInput.md)\>

Defined in: generated/prisma/index.d.ts:5403

In case the ai_telemetry_logs found by the `where` argument doesn't exist, create a new ai_telemetry_logs with this data.

***

### omit?

> `optional` **omit?**: [`ai_telemetry_logsOmit`](ai_telemetry_logsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:5395

Omit specific fields from the ai_telemetry_logs

***

### select?

> `optional` **select?**: [`ai_telemetry_logsSelect`](ai_telemetry_logsSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:5391

Select specific fields to fetch from the ai_telemetry_logs

***

### update

> **update**: [`XOR`](XOR.md)\<[`ai_telemetry_logsUpdateInput`](ai_telemetry_logsUpdateInput.md), [`ai_telemetry_logsUncheckedUpdateInput`](ai_telemetry_logsUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:5407

In case the ai_telemetry_logs was found with the provided `where` argument, update it with this data.

***

### where

> **where**: [`ai_telemetry_logsWhereUniqueInput`](ai_telemetry_logsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:5399

The filter to search for the ai_telemetry_logs to update in case it exists.
