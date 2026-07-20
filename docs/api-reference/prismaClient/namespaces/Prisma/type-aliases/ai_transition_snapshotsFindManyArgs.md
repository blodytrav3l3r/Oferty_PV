[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_transition\_snapshotsFindManyArgs

# Type Alias: ai\_transition\_snapshotsFindManyArgs\<ExtArgs\>

> **ai\_transition\_snapshotsFindManyArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:12093

ai_transition_snapshots findMany

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`ai_transition_snapshotsWhereUniqueInput`](ai_transition_snapshotsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:12117

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for listing ai_transition_snapshots.

***

### distinct?

> `optional` **distinct?**: [`Ai_transition_snapshotsScalarFieldEnum`](Ai_transition_snapshotsScalarFieldEnum.md) \| [`Ai_transition_snapshotsScalarFieldEnum`](Ai_transition_snapshotsScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:12130

***

### omit?

> `optional` **omit?**: [`ai_transition_snapshotsOmit`](ai_transition_snapshotsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:12101

Omit specific fields from the ai_transition_snapshots

***

### orderBy?

> `optional` **orderBy?**: [`ai_transition_snapshotsOrderByWithRelationInput`](ai_transition_snapshotsOrderByWithRelationInput.md) \| [`ai_transition_snapshotsOrderByWithRelationInput`](ai_transition_snapshotsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:12111

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of ai_transition_snapshots to fetch.

***

### select?

> `optional` **select?**: [`ai_transition_snapshotsSelect`](ai_transition_snapshotsSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:12097

Select specific fields to fetch from the ai_transition_snapshots

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:12129

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` ai_transition_snapshots.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:12123

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` ai_transition_snapshots from the position of the cursor.

***

### where?

> `optional` **where?**: [`ai_transition_snapshotsWhereInput`](ai_transition_snapshotsWhereInput.md)

Defined in: generated/prisma/index.d.ts:12105

Filter, which ai_transition_snapshots to fetch.
