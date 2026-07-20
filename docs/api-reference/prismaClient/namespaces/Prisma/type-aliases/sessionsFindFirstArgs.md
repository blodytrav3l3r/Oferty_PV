[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / sessionsFindFirstArgs

# Type Alias: sessionsFindFirstArgs\<ExtArgs\>

> **sessionsFindFirstArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:26583

sessions findFirst

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`sessionsWhereUniqueInput`](sessionsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:26607

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for sessions.

***

### distinct?

> `optional` **distinct?**: [`SessionsScalarFieldEnum`](SessionsScalarFieldEnum.md) \| [`SessionsScalarFieldEnum`](SessionsScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:26625

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of sessions.

***

### omit?

> `optional` **omit?**: [`sessionsOmit`](sessionsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:26591

Omit specific fields from the sessions

***

### orderBy?

> `optional` **orderBy?**: [`sessionsOrderByWithRelationInput`](sessionsOrderByWithRelationInput.md) \| [`sessionsOrderByWithRelationInput`](sessionsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:26601

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of sessions to fetch.

***

### select?

> `optional` **select?**: [`sessionsSelect`](sessionsSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:26587

Select specific fields to fetch from the sessions

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:26619

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` sessions.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:26613

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` sessions from the position of the cursor.

***

### where?

> `optional` **where?**: [`sessionsWhereInput`](sessionsWhereInput.md)

Defined in: generated/prisma/index.d.ts:26595

Filter, which sessions to fetch.
