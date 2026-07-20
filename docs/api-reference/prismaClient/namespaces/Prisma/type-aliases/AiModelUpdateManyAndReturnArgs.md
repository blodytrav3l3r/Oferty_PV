[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiModelUpdateManyAndReturnArgs

# Type Alias: AiModelUpdateManyAndReturnArgs\<ExtArgs\>

> **AiModelUpdateManyAndReturnArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:35007

AiModel updateManyAndReturn

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`AiModelUpdateManyMutationInput`](AiModelUpdateManyMutationInput.md), [`AiModelUncheckedUpdateManyInput`](AiModelUncheckedUpdateManyInput.md)\>

Defined in: generated/prisma/index.d.ts:35019

The data used to update AiModels.

***

### limit?

> `optional` **limit?**: `number`

Defined in: generated/prisma/index.d.ts:35027

Limit how many AiModels to update.

***

### omit?

> `optional` **omit?**: [`AiModelOmit`](AiModelOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:35015

Omit specific fields from the AiModel

***

### select?

> `optional` **select?**: [`AiModelSelectUpdateManyAndReturn`](AiModelSelectUpdateManyAndReturn.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:35011

Select specific fields to fetch from the AiModel

***

### where?

> `optional` **where?**: [`AiModelWhereInput`](AiModelWhereInput.md)

Defined in: generated/prisma/index.d.ts:35023

Filter which AiModels to update
