[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / audit\_logsFindManyArgs

# Type Alias: audit\_logsFindManyArgs\<ExtArgs\>

> **audit\_logsFindManyArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:13125

audit_logs findMany

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`audit_logsWhereUniqueInput`](audit_logsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:13149

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for listing audit_logs.

---

### distinct?

> `optional` **distinct?**: [`Audit_logsScalarFieldEnum`](Audit_logsScalarFieldEnum.md) \| [`Audit_logsScalarFieldEnum`](Audit_logsScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:13162

---

### omit?

> `optional` **omit?**: [`audit_logsOmit`](audit_logsOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:13133

Omit specific fields from the audit_logs

---

### orderBy?

> `optional` **orderBy?**: [`audit_logsOrderByWithRelationInput`](audit_logsOrderByWithRelationInput.md) \| [`audit_logsOrderByWithRelationInput`](audit_logsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:13143

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of audit_logs to fetch.

---

### select?

> `optional` **select?**: [`audit_logsSelect`](audit_logsSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:13129

Select specific fields to fetch from the audit_logs

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:13161

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` audit_logs.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:13155

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` audit_logs from the position of the cursor.

---

### where?

> `optional` **where?**: [`audit_logsWhereInput`](audit_logsWhereInput.md)

Defined in: generated/prisma/index.d.ts:13137

Filter, which audit_logs to fetch.
