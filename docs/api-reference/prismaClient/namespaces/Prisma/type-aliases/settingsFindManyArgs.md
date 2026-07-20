[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / settingsFindManyArgs

# Type Alias: settingsFindManyArgs\<ExtArgs\>

> **settingsFindManyArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:27633

settings findMany

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`settingsWhereUniqueInput`](settingsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:27657

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for listing settings.

***

### distinct?

> `optional` **distinct?**: [`SettingsScalarFieldEnum`](SettingsScalarFieldEnum.md) \| [`SettingsScalarFieldEnum`](SettingsScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:27670

***

### omit?

> `optional` **omit?**: [`settingsOmit`](settingsOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:27641

Omit specific fields from the settings

***

### orderBy?

> `optional` **orderBy?**: [`settingsOrderByWithRelationInput`](settingsOrderByWithRelationInput.md) \| [`settingsOrderByWithRelationInput`](settingsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:27651

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of settings to fetch.

***

### select?

> `optional` **select?**: [`settingsSelect`](settingsSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:27637

Select specific fields to fetch from the settings

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:27669

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` settings.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:27663

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` settings from the position of the cursor.

***

### where?

> `optional` **where?**: [`settingsWhereInput`](settingsWhereInput.md)

Defined in: generated/prisma/index.d.ts:27645

Filter, which settings to fetch.
