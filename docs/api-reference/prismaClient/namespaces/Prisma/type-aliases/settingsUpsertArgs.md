[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / settingsUpsertArgs

# Type Alias: settingsUpsertArgs\<ExtArgs\>

> **settingsUpsertArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:27788

settings upsert

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`settingsCreateInput`](settingsCreateInput.md), [`settingsUncheckedCreateInput`](settingsUncheckedCreateInput.md)\>

Defined in: generated/prisma/index.d.ts:27804

In case the settings found by the `where` argument doesn't exist, create a new settings with this data.

***

### omit?

> `optional` **omit?**: [`settingsOmit`](settingsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:27796

Omit specific fields from the settings

***

### select?

> `optional` **select?**: [`settingsSelect`](settingsSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:27792

Select specific fields to fetch from the settings

***

### update

> **update**: [`XOR`](XOR.md)\<[`settingsUpdateInput`](settingsUpdateInput.md), [`settingsUncheckedUpdateInput`](settingsUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:27808

In case the settings was found with the provided `where` argument, update it with this data.

***

### where

> **where**: [`settingsWhereUniqueInput`](settingsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:27800

The filter to search for the settings to update in case it exists.
