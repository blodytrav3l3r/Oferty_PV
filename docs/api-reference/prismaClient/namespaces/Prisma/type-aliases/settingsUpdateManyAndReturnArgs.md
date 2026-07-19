[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / settingsUpdateManyAndReturnArgs

# Type Alias: settingsUpdateManyAndReturnArgs\<ExtArgs\>

> **settingsUpdateManyAndReturnArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:27762

settings updateManyAndReturn

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`settingsUpdateManyMutationInput`](settingsUpdateManyMutationInput.md), [`settingsUncheckedUpdateManyInput`](settingsUncheckedUpdateManyInput.md)>\>

Defined in: generated/prisma/index.d.ts:27774

The data used to update settings.

---

### limit?

> `optional` **limit?**: `number`

Defined in: generated/prisma/index.d.ts:27782

Limit how many settings to update.

---

### omit?

> `optional` **omit?**: [`settingsOmit`](settingsOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:27770

Omit specific fields from the settings

---

### select?

> `optional` **select?**: [`settingsSelectUpdateManyAndReturn`](settingsSelectUpdateManyAndReturn.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:27766

Select specific fields to fetch from the settings

---

### where?

> `optional` **where?**: [`settingsWhereInput`](settingsWhereInput.md)

Defined in: generated/prisma/index.d.ts:27778

Filter which settings to update
