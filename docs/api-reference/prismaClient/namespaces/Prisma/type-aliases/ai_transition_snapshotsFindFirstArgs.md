[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_transition\_snapshotsFindFirstArgs

# Type Alias: ai\_transition\_snapshotsFindFirstArgs\<ExtArgs\>

> **ai\_transition\_snapshotsFindFirstArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:11997

ai_transition_snapshots findFirst

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`ai_transition_snapshotsWhereUniqueInput`](ai_transition_snapshotsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:12021

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for ai_transition_snapshots.

***

### distinct?

> `optional` **distinct?**: [`Ai_transition_snapshotsScalarFieldEnum`](Ai_transition_snapshotsScalarFieldEnum.md) \| [`Ai_transition_snapshotsScalarFieldEnum`](Ai_transition_snapshotsScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:12039

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of ai_transition_snapshots.

***

### omit?

> `optional` **omit?**: [`ai_transition_snapshotsOmit`](ai_transition_snapshotsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:12005

Omit specific fields from the ai_transition_snapshots

***

### orderBy?

> `optional` **orderBy?**: [`ai_transition_snapshotsOrderByWithRelationInput`](ai_transition_snapshotsOrderByWithRelationInput.md) \| [`ai_transition_snapshotsOrderByWithRelationInput`](ai_transition_snapshotsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:12015

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of ai_transition_snapshots to fetch.

***

### select?

> `optional` **select?**: [`ai_transition_snapshotsSelect`](ai_transition_snapshotsSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:12001

Select specific fields to fetch from the ai_transition_snapshots

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:12033

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` ai_transition_snapshots.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:12027

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` ai_transition_snapshots from the position of the cursor.

***

### where?

> `optional` **where?**: [`ai_transition_snapshotsWhereInput`](ai_transition_snapshotsWhereInput.md)

Defined in: generated/prisma/index.d.ts:12009

Filter, which ai_transition_snapshots to fetch.
