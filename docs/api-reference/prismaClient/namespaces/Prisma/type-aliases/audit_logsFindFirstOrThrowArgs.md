[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / audit\_logsFindFirstOrThrowArgs

# Type Alias: audit\_logsFindFirstOrThrowArgs\<ExtArgs\>

> **audit\_logsFindFirstOrThrowArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:13077

audit_logs findFirstOrThrow

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`audit_logsWhereUniqueInput`](audit_logsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:13101

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for audit_logs.

---

### distinct?

> `optional` **distinct?**: [`Audit_logsScalarFieldEnum`](Audit_logsScalarFieldEnum.md) \| [`Audit_logsScalarFieldEnum`](Audit_logsScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:13119

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of audit_logs.

---

### omit?

> `optional` **omit?**: [`audit_logsOmit`](audit_logsOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:13085

Omit specific fields from the audit_logs

---

### orderBy?

> `optional` **orderBy?**: [`audit_logsOrderByWithRelationInput`](audit_logsOrderByWithRelationInput.md) \| [`audit_logsOrderByWithRelationInput`](audit_logsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:13095

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of audit_logs to fetch.

---

### select?

> `optional` **select?**: [`audit_logsSelect`](audit_logsSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:13081

Select specific fields to fetch from the audit_logs

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:13113

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` audit_logs.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:13107

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` audit_logs from the position of the cursor.

---

### where?

> `optional` **where?**: [`audit_logsWhereInput`](audit_logsWhereInput.md)

Defined in: generated/prisma/index.d.ts:13089

Filter, which audit_logs to fetch.
