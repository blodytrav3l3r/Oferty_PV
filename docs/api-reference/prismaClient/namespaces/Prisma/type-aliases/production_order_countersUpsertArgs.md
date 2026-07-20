[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / production\_order\_countersUpsertArgs

# Type Alias: production\_order\_countersUpsertArgs\<ExtArgs\>

> **production\_order\_countersUpsertArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:23749

production_order_counters upsert

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`production_order_countersCreateInput`](production_order_countersCreateInput.md), [`production_order_countersUncheckedCreateInput`](production_order_countersUncheckedCreateInput.md)>\>

Defined in: generated/prisma/index.d.ts:23765

In case the production_order_counters found by the `where` argument doesn't exist, create a new production_order_counters with this data.

---

### omit?

> `optional` **omit?**: [`production_order_countersOmit`](production_order_countersOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:23757

Omit specific fields from the production_order_counters

---

### select?

> `optional` **select?**: [`production_order_countersSelect`](production_order_countersSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:23753

Select specific fields to fetch from the production_order_counters

---

### update

> **update**: [`XOR`](XOR.md)\<[`production_order_countersUpdateInput`](production_order_countersUpdateInput.md), [`production_order_countersUncheckedUpdateInput`](production_order_countersUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:23769

In case the production_order_counters was found with the provided `where` argument, update it with this data.

---

### where

> **where**: [`production_order_countersWhereUniqueInput`](production_order_countersWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:23761

The filter to search for the production_order_counters to update in case it exists.
