[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / aiRewardLogFindManyArgs

# Type Alias: aiRewardLogFindManyArgs\<ExtArgs\>

> **aiRewardLogFindManyArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:37060

aiRewardLog findMany

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`aiRewardLogWhereUniqueInput`](aiRewardLogWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:37084

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for listing aiRewardLogs.

---

### distinct?

> `optional` **distinct?**: [`AiRewardLogScalarFieldEnum`](AiRewardLogScalarFieldEnum.md) \| [`AiRewardLogScalarFieldEnum`](AiRewardLogScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:37097

---

### omit?

> `optional` **omit?**: [`aiRewardLogOmit`](aiRewardLogOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:37068

Omit specific fields from the aiRewardLog

---

### orderBy?

> `optional` **orderBy?**: [`aiRewardLogOrderByWithRelationInput`](aiRewardLogOrderByWithRelationInput.md) \| [`aiRewardLogOrderByWithRelationInput`](aiRewardLogOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:37078

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of aiRewardLogs to fetch.

---

### select?

> `optional` **select?**: [`aiRewardLogSelect`](aiRewardLogSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:37064

Select specific fields to fetch from the aiRewardLog

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:37096

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` aiRewardLogs.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:37090

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` aiRewardLogs from the position of the cursor.

---

### where?

> `optional` **where?**: [`aiRewardLogWhereInput`](aiRewardLogWhereInput.md)

Defined in: generated/prisma/index.d.ts:37072

Filter, which aiRewardLogs to fetch.
