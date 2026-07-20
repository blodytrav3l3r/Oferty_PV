[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / settingsFindFirstArgs

# Type Alias: settingsFindFirstArgs\<ExtArgs\>

> **settingsFindFirstArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:27537

settings findFirst

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`settingsWhereUniqueInput`](settingsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:27561

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for settings.

---

### distinct?

> `optional` **distinct?**: [`SettingsScalarFieldEnum`](SettingsScalarFieldEnum.md) \| [`SettingsScalarFieldEnum`](SettingsScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:27579

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of settings.

---

### omit?

> `optional` **omit?**: [`settingsOmit`](settingsOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:27545

Omit specific fields from the settings

---

### orderBy?

> `optional` **orderBy?**: [`settingsOrderByWithRelationInput`](settingsOrderByWithRelationInput.md) \| [`settingsOrderByWithRelationInput`](settingsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:27555

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of settings to fetch.

---

### select?

> `optional` **select?**: [`settingsSelect`](settingsSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:27541

Select specific fields to fetch from the settings

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:27573

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` settings.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:27567

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` settings from the position of the cursor.

---

### where?

> `optional` **where?**: [`settingsWhereInput`](settingsWhereInput.md)

Defined in: generated/prisma/index.d.ts:27549

Filter, which settings to fetch.
