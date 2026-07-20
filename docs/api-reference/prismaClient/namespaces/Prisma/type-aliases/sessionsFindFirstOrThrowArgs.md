[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / sessionsFindFirstOrThrowArgs

# Type Alias: sessionsFindFirstOrThrowArgs\<ExtArgs\>

> **sessionsFindFirstOrThrowArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:26631

sessions findFirstOrThrow

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`sessionsWhereUniqueInput`](sessionsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:26655

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for sessions.

***

### distinct?

> `optional` **distinct?**: [`SessionsScalarFieldEnum`](SessionsScalarFieldEnum.md) \| [`SessionsScalarFieldEnum`](SessionsScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:26673

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of sessions.

***

### omit?

> `optional` **omit?**: [`sessionsOmit`](sessionsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:26639

Omit specific fields from the sessions

***

### orderBy?

> `optional` **orderBy?**: [`sessionsOrderByWithRelationInput`](sessionsOrderByWithRelationInput.md) \| [`sessionsOrderByWithRelationInput`](sessionsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:26649

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of sessions to fetch.

***

### select?

> `optional` **select?**: [`sessionsSelect`](sessionsSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:26635

Select specific fields to fetch from the sessions

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:26667

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` sessions.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:26661

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` sessions from the position of the cursor.

***

### where?

> `optional` **where?**: [`sessionsWhereInput`](sessionsWhereInput.md)

Defined in: generated/prisma/index.d.ts:26643

Filter, which sessions to fetch.
