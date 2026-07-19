[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / usersUpdateManyArgs

# Type Alias: usersUpdateManyArgs\<ExtArgs\>

> **usersUpdateManyArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:38323

users updateMany

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`usersUpdateManyMutationInput`](usersUpdateManyMutationInput.md), [`usersUncheckedUpdateManyInput`](usersUncheckedUpdateManyInput.md)>\>

Defined in: generated/prisma/index.d.ts:38327

The data used to update users.

---

### limit?

> `optional` **limit?**: `number`

Defined in: generated/prisma/index.d.ts:38335

Limit how many users to update.

---

### where?

> `optional` **where?**: [`usersWhereInput`](usersWhereInput.md)

Defined in: generated/prisma/index.d.ts:38331

Filter which users to update
