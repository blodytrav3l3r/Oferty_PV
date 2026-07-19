[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / order\_counters\_ruryUpsertArgs

# Type Alias: order\_counters\_ruryUpsertArgs\<ExtArgs\>

> **order\_counters\_ruryUpsertArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:20732

order_counters_rury upsert

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`order_counters_ruryCreateInput`](order_counters_ruryCreateInput.md), [`order_counters_ruryUncheckedCreateInput`](order_counters_ruryUncheckedCreateInput.md)>\>

Defined in: generated/prisma/index.d.ts:20748

In case the order_counters_rury found by the `where` argument doesn't exist, create a new order_counters_rury with this data.

---

### omit?

> `optional` **omit?**: [`order_counters_ruryOmit`](order_counters_ruryOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:20740

Omit specific fields from the order_counters_rury

---

### select?

> `optional` **select?**: [`order_counters_rurySelect`](order_counters_rurySelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:20736

Select specific fields to fetch from the order_counters_rury

---

### update

> **update**: [`XOR`](XOR.md)\<[`order_counters_ruryUpdateInput`](order_counters_ruryUpdateInput.md), [`order_counters_ruryUncheckedUpdateInput`](order_counters_ruryUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:20752

In case the order_counters_rury was found with the provided `where` argument, update it with this data.

---

### where

> **where**: [`order_counters_ruryWhereUniqueInput`](order_counters_ruryWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:20744

The filter to search for the order_counters_rury to update in case it exists.
