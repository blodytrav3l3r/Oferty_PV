[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / aiRewardLogUpdateManyAndReturnArgs

# Type Alias: aiRewardLogUpdateManyAndReturnArgs\<ExtArgs\>

> **aiRewardLogUpdateManyAndReturnArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:37189

aiRewardLog updateManyAndReturn

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`aiRewardLogUpdateManyMutationInput`](aiRewardLogUpdateManyMutationInput.md), [`aiRewardLogUncheckedUpdateManyInput`](aiRewardLogUncheckedUpdateManyInput.md)\>

Defined in: generated/prisma/index.d.ts:37201

The data used to update aiRewardLogs.

***

### limit?

> `optional` **limit?**: `number`

Defined in: generated/prisma/index.d.ts:37209

Limit how many aiRewardLogs to update.

***

### omit?

> `optional` **omit?**: [`aiRewardLogOmit`](aiRewardLogOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:37197

Omit specific fields from the aiRewardLog

***

### select?

> `optional` **select?**: [`aiRewardLogSelectUpdateManyAndReturn`](aiRewardLogSelectUpdateManyAndReturn.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:37193

Select specific fields to fetch from the aiRewardLog

***

### where?

> `optional` **where?**: [`aiRewardLogWhereInput`](aiRewardLogWhereInput.md)

Defined in: generated/prisma/index.d.ts:37205

Filter which aiRewardLogs to update
