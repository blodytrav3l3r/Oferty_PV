[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / order\_countersUpdateArgs

# Type Alias: order\_countersUpdateArgs\<ExtArgs\>

> **order\_countersUpdateArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:19661

order_counters update

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`order_countersUpdateInput`](order_countersUpdateInput.md), [`order_countersUncheckedUpdateInput`](order_countersUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:19673

The data needed to update a order_counters.

---

### omit?

> `optional` **omit?**: [`order_countersOmit`](order_countersOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:19669

Omit specific fields from the order_counters

---

### select?

> `optional` **select?**: [`order_countersSelect`](order_countersSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:19665

Select specific fields to fetch from the order_counters

---

### where

> **where**: [`order_countersWhereUniqueInput`](order_countersWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:19677

Choose, which order_counters to update.
