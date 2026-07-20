[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / sessionsUpdateManyAndReturnArgs

# Type Alias: sessionsUpdateManyAndReturnArgs\<ExtArgs\>

> **sessionsUpdateManyAndReturnArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:26808

sessions updateManyAndReturn

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`sessionsUpdateManyMutationInput`](sessionsUpdateManyMutationInput.md), [`sessionsUncheckedUpdateManyInput`](sessionsUncheckedUpdateManyInput.md)\>

Defined in: generated/prisma/index.d.ts:26820

The data used to update sessions.

***

### limit?

> `optional` **limit?**: `number`

Defined in: generated/prisma/index.d.ts:26828

Limit how many sessions to update.

***

### omit?

> `optional` **omit?**: [`sessionsOmit`](sessionsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:26816

Omit specific fields from the sessions

***

### select?

> `optional` **select?**: [`sessionsSelectUpdateManyAndReturn`](sessionsSelectUpdateManyAndReturn.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:26812

Select specific fields to fetch from the sessions

***

### where?

> `optional` **where?**: [`sessionsWhereInput`](sessionsWhereInput.md)

Defined in: generated/prisma/index.d.ts:26824

Filter which sessions to update
