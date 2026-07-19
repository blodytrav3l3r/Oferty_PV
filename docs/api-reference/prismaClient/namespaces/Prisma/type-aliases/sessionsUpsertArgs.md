[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / sessionsUpsertArgs

# Type Alias: sessionsUpsertArgs\<ExtArgs\>

> **sessionsUpsertArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:26834

sessions upsert

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`sessionsCreateInput`](sessionsCreateInput.md), [`sessionsUncheckedCreateInput`](sessionsUncheckedCreateInput.md)>\>

Defined in: generated/prisma/index.d.ts:26850

In case the sessions found by the `where` argument doesn't exist, create a new sessions with this data.

---

### omit?

> `optional` **omit?**: [`sessionsOmit`](sessionsOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:26842

Omit specific fields from the sessions

---

### select?

> `optional` **select?**: [`sessionsSelect`](sessionsSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:26838

Select specific fields to fetch from the sessions

---

### update

> **update**: [`XOR`](XOR.md)\<[`sessionsUpdateInput`](sessionsUpdateInput.md), [`sessionsUncheckedUpdateInput`](sessionsUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:26854

In case the sessions was found with the provided `where` argument, update it with this data.

---

### where

> **where**: [`sessionsWhereUniqueInput`](sessionsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:26846

The filter to search for the sessions to update in case it exists.
