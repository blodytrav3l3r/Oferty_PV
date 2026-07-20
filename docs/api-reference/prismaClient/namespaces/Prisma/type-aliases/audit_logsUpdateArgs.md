[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / audit\_logsUpdateArgs

# Type Alias: audit\_logsUpdateArgs\<ExtArgs\>

> **audit\_logsUpdateArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:13214

audit_logs update

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`audit_logsUpdateInput`](audit_logsUpdateInput.md), [`audit_logsUncheckedUpdateInput`](audit_logsUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:13226

The data needed to update a audit_logs.

***

### omit?

> `optional` **omit?**: [`audit_logsOmit`](audit_logsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:13222

Omit specific fields from the audit_logs

***

### select?

> `optional` **select?**: [`audit_logsSelect`](audit_logsSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:13218

Select specific fields to fetch from the audit_logs

***

### where

> **where**: [`audit_logsWhereUniqueInput`](audit_logsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:13230

Choose, which audit_logs to update.
