[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / settingsUpdateArgs

# Type Alias: settingsUpdateArgs\<ExtArgs\>

> **settingsUpdateArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:27722

settings update

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`settingsUpdateInput`](settingsUpdateInput.md), [`settingsUncheckedUpdateInput`](settingsUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:27734

The data needed to update a settings.

***

### omit?

> `optional` **omit?**: [`settingsOmit`](settingsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:27730

Omit specific fields from the settings

***

### select?

> `optional` **select?**: [`settingsSelect`](settingsSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:27726

Select specific fields to fetch from the settings

***

### where

> **where**: [`settingsWhereUniqueInput`](settingsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:27738

Choose, which settings to update.
