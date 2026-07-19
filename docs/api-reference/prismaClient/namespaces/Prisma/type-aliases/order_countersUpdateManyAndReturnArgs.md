[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / order\_countersUpdateManyAndReturnArgs

# Type Alias: order\_countersUpdateManyAndReturnArgs\<ExtArgs\>

> **order\_countersUpdateManyAndReturnArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:19701

order_counters updateManyAndReturn

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`order_countersUpdateManyMutationInput`](order_countersUpdateManyMutationInput.md), [`order_countersUncheckedUpdateManyInput`](order_countersUncheckedUpdateManyInput.md)>\>

Defined in: generated/prisma/index.d.ts:19713

The data used to update order_counters.

---

### limit?

> `optional` **limit?**: `number`

Defined in: generated/prisma/index.d.ts:19721

Limit how many order_counters to update.

---

### omit?

> `optional` **omit?**: [`order_countersOmit`](order_countersOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:19709

Omit specific fields from the order_counters

---

### select?

> `optional` **select?**: [`order_countersSelectUpdateManyAndReturn`](order_countersSelectUpdateManyAndReturn.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:19705

Select specific fields to fetch from the order_counters

---

### where?

> `optional` **where?**: [`order_countersWhereInput`](order_countersWhereInput.md)

Defined in: generated/prisma/index.d.ts:19717

Filter which order_counters to update
