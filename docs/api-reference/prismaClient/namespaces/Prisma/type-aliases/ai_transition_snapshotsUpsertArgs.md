[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_transition\_snapshotsUpsertArgs

# Type Alias: ai\_transition\_snapshotsUpsertArgs\<ExtArgs\>

> **ai\_transition\_snapshotsUpsertArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:12248

ai_transition_snapshots upsert

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`ai_transition_snapshotsCreateInput`](ai_transition_snapshotsCreateInput.md), [`ai_transition_snapshotsUncheckedCreateInput`](ai_transition_snapshotsUncheckedCreateInput.md)\>

Defined in: generated/prisma/index.d.ts:12264

In case the ai_transition_snapshots found by the `where` argument doesn't exist, create a new ai_transition_snapshots with this data.

***

### omit?

> `optional` **omit?**: [`ai_transition_snapshotsOmit`](ai_transition_snapshotsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:12256

Omit specific fields from the ai_transition_snapshots

***

### select?

> `optional` **select?**: [`ai_transition_snapshotsSelect`](ai_transition_snapshotsSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:12252

Select specific fields to fetch from the ai_transition_snapshots

***

### update

> **update**: [`XOR`](XOR.md)\<[`ai_transition_snapshotsUpdateInput`](ai_transition_snapshotsUpdateInput.md), [`ai_transition_snapshotsUncheckedUpdateInput`](ai_transition_snapshotsUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:12268

In case the ai_transition_snapshots was found with the provided `where` argument, update it with this data.

***

### where

> **where**: [`ai_transition_snapshotsWhereUniqueInput`](ai_transition_snapshotsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:12260

The filter to search for the ai_transition_snapshots to update in case it exists.
