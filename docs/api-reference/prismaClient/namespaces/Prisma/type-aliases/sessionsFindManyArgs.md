[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / sessionsFindManyArgs

# Type Alias: sessionsFindManyArgs\<ExtArgs\>

> **sessionsFindManyArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:26679

sessions findMany

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`sessionsWhereUniqueInput`](sessionsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:26703

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for listing sessions.

***

### distinct?

> `optional` **distinct?**: [`SessionsScalarFieldEnum`](SessionsScalarFieldEnum.md) \| [`SessionsScalarFieldEnum`](SessionsScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:26716

***

### omit?

> `optional` **omit?**: [`sessionsOmit`](sessionsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:26687

Omit specific fields from the sessions

***

### orderBy?

> `optional` **orderBy?**: [`sessionsOrderByWithRelationInput`](sessionsOrderByWithRelationInput.md) \| [`sessionsOrderByWithRelationInput`](sessionsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:26697

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of sessions to fetch.

***

### select?

> `optional` **select?**: [`sessionsSelect`](sessionsSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:26683

Select specific fields to fetch from the sessions

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:26715

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` sessions.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:26709

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` sessions from the position of the cursor.

***

### where?

> `optional` **where?**: [`sessionsWhereInput`](sessionsWhereInput.md)

Defined in: generated/prisma/index.d.ts:26691

Filter, which sessions to fetch.
