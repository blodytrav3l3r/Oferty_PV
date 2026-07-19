[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / audit\_logsUpsertArgs

# Type Alias: audit\_logsUpsertArgs\<ExtArgs\>

> **audit\_logsUpsertArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:13280

audit_logs upsert

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`audit_logsCreateInput`](audit_logsCreateInput.md), [`audit_logsUncheckedCreateInput`](audit_logsUncheckedCreateInput.md)>\>

Defined in: generated/prisma/index.d.ts:13296

In case the audit_logs found by the `where` argument doesn't exist, create a new audit_logs with this data.

---

### omit?

> `optional` **omit?**: [`audit_logsOmit`](audit_logsOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:13288

Omit specific fields from the audit_logs

---

### select?

> `optional` **select?**: [`audit_logsSelect`](audit_logsSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:13284

Select specific fields to fetch from the audit_logs

---

### update

> **update**: [`XOR`](XOR.md)\<[`audit_logsUpdateInput`](audit_logsUpdateInput.md), [`audit_logsUncheckedUpdateInput`](audit_logsUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:13300

In case the audit_logs was found with the provided `where` argument, update it with this data.

---

### where

> **where**: [`audit_logsWhereUniqueInput`](audit_logsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:13292

The filter to search for the audit_logs to update in case it exists.
