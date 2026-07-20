[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / sessionsUpdateArgs

# Type Alias: sessionsUpdateArgs\<ExtArgs\>

> **sessionsUpdateArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:26768

sessions update

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`sessionsUpdateInput`](sessionsUpdateInput.md), [`sessionsUncheckedUpdateInput`](sessionsUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:26780

The data needed to update a sessions.

---

### omit?

> `optional` **omit?**: [`sessionsOmit`](sessionsOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:26776

Omit specific fields from the sessions

---

### select?

> `optional` **select?**: [`sessionsSelect`](sessionsSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:26772

Select specific fields to fetch from the sessions

---

### where

> **where**: [`sessionsWhereUniqueInput`](sessionsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:26784

Choose, which sessions to update.
