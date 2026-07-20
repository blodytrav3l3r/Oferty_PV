[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / audit\_logsUpdateManyAndReturnArgs

# Type Alias: audit\_logsUpdateManyAndReturnArgs\<ExtArgs\>

> **audit\_logsUpdateManyAndReturnArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:13254

audit_logs updateManyAndReturn

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`audit_logsUpdateManyMutationInput`](audit_logsUpdateManyMutationInput.md), [`audit_logsUncheckedUpdateManyInput`](audit_logsUncheckedUpdateManyInput.md)\>

Defined in: generated/prisma/index.d.ts:13266

The data used to update audit_logs.

***

### limit?

> `optional` **limit?**: `number`

Defined in: generated/prisma/index.d.ts:13274

Limit how many audit_logs to update.

***

### omit?

> `optional` **omit?**: [`audit_logsOmit`](audit_logsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:13262

Omit specific fields from the audit_logs

***

### select?

> `optional` **select?**: [`audit_logsSelectUpdateManyAndReturn`](audit_logsSelectUpdateManyAndReturn.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:13258

Select specific fields to fetch from the audit_logs

***

### where?

> `optional` **where?**: [`audit_logsWhereInput`](audit_logsWhereInput.md)

Defined in: generated/prisma/index.d.ts:13270

Filter which audit_logs to update
