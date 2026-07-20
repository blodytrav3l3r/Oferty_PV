[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiFeatureUpdateManyAndReturnArgs

# Type Alias: AiFeatureUpdateManyAndReturnArgs\<ExtArgs\>

> **AiFeatureUpdateManyAndReturnArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:33885

AiFeature updateManyAndReturn

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`AiFeatureUpdateManyMutationInput`](AiFeatureUpdateManyMutationInput.md), [`AiFeatureUncheckedUpdateManyInput`](AiFeatureUncheckedUpdateManyInput.md)\>

Defined in: generated/prisma/index.d.ts:33897

The data used to update AiFeatures.

***

### limit?

> `optional` **limit?**: `number`

Defined in: generated/prisma/index.d.ts:33905

Limit how many AiFeatures to update.

***

### omit?

> `optional` **omit?**: [`AiFeatureOmit`](AiFeatureOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:33893

Omit specific fields from the AiFeature

***

### select?

> `optional` **select?**: [`AiFeatureSelectUpdateManyAndReturn`](AiFeatureSelectUpdateManyAndReturn.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:33889

Select specific fields to fetch from the AiFeature

***

### where?

> `optional` **where?**: [`AiFeatureWhereInput`](AiFeatureWhereInput.md)

Defined in: generated/prisma/index.d.ts:33901

Filter which AiFeatures to update
