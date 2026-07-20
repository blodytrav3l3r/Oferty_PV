[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / aiRewardLogFindFirstArgs

# Type Alias: aiRewardLogFindFirstArgs\<ExtArgs\>

> **aiRewardLogFindFirstArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:36964

aiRewardLog findFirst

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`aiRewardLogWhereUniqueInput`](aiRewardLogWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:36988

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for aiRewardLogs.

---

### distinct?

> `optional` **distinct?**: [`AiRewardLogScalarFieldEnum`](AiRewardLogScalarFieldEnum.md) \| [`AiRewardLogScalarFieldEnum`](AiRewardLogScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:37006

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of aiRewardLogs.

---

### omit?

> `optional` **omit?**: [`aiRewardLogOmit`](aiRewardLogOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:36972

Omit specific fields from the aiRewardLog

---

### orderBy?

> `optional` **orderBy?**: [`aiRewardLogOrderByWithRelationInput`](aiRewardLogOrderByWithRelationInput.md) \| [`aiRewardLogOrderByWithRelationInput`](aiRewardLogOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:36982

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of aiRewardLogs to fetch.

---

### select?

> `optional` **select?**: [`aiRewardLogSelect`](aiRewardLogSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:36968

Select specific fields to fetch from the aiRewardLog

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:37000

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` aiRewardLogs.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:36994

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` aiRewardLogs from the position of the cursor.

---

### where?

> `optional` **where?**: [`aiRewardLogWhereInput`](aiRewardLogWhereInput.md)

Defined in: generated/prisma/index.d.ts:36976

Filter, which aiRewardLog to fetch.
