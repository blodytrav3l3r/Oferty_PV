[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / usersUpdateArgs

# Type Alias: usersUpdateArgs\<ExtArgs\>

> **usersUpdateArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:38301

users update

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`usersUpdateInput`](usersUpdateInput.md), [`usersUncheckedUpdateInput`](usersUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:38313

The data needed to update a users.

---

### omit?

> `optional` **omit?**: [`usersOmit`](usersOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:38309

Omit specific fields from the users

---

### select?

> `optional` **select?**: [`usersSelect`](usersSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:38305

Select specific fields to fetch from the users

---

### where

> **where**: [`usersWhereUniqueInput`](usersWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:38317

Choose, which users to update.
