[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / usersUpsertArgs

# Type Alias: usersUpsertArgs\<ExtArgs\>

> **usersUpsertArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:38367

users upsert

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`usersCreateInput`](usersCreateInput.md), [`usersUncheckedCreateInput`](usersUncheckedCreateInput.md)>\>

Defined in: generated/prisma/index.d.ts:38383

In case the users found by the `where` argument doesn't exist, create a new users with this data.

---

### omit?

> `optional` **omit?**: [`usersOmit`](usersOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:38375

Omit specific fields from the users

---

### select?

> `optional` **select?**: [`usersSelect`](usersSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:38371

Select specific fields to fetch from the users

---

### update

> **update**: [`XOR`](XOR.md)\<[`usersUpdateInput`](usersUpdateInput.md), [`usersUncheckedUpdateInput`](usersUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:38387

In case the users was found with the provided `where` argument, update it with this data.

---

### where

> **where**: [`usersWhereUniqueInput`](usersWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:38379

The filter to search for the users to update in case it exists.
