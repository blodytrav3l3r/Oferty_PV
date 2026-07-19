[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / usersUpdateManyAndReturnArgs

# Type Alias: usersUpdateManyAndReturnArgs\<ExtArgs\>

> **usersUpdateManyAndReturnArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:38341

users updateManyAndReturn

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`usersUpdateManyMutationInput`](usersUpdateManyMutationInput.md), [`usersUncheckedUpdateManyInput`](usersUncheckedUpdateManyInput.md)>\>

Defined in: generated/prisma/index.d.ts:38353

The data used to update users.

---

### limit?

> `optional` **limit?**: `number`

Defined in: generated/prisma/index.d.ts:38361

Limit how many users to update.

---

### omit?

> `optional` **omit?**: [`usersOmit`](usersOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:38349

Omit specific fields from the users

---

### select?

> `optional` **select?**: [`usersSelectUpdateManyAndReturn`](usersSelectUpdateManyAndReturn.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:38345

Select specific fields to fetch from the users

---

### where?

> `optional` **where?**: [`usersWhereInput`](usersWhereInput.md)

Defined in: generated/prisma/index.d.ts:38357

Filter which users to update
