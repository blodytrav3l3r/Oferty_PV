[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / production\_orders\_relUpsertArgs

# Type Alias: production\_orders\_relUpsertArgs\<ExtArgs\>

> **production\_orders\_relUpsertArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:24828

production_orders_rel upsert

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`production_orders_relCreateInput`](production_orders_relCreateInput.md), [`production_orders_relUncheckedCreateInput`](production_orders_relUncheckedCreateInput.md)>\>

Defined in: generated/prisma/index.d.ts:24844

In case the production_orders_rel found by the `where` argument doesn't exist, create a new production_orders_rel with this data.

---

### omit?

> `optional` **omit?**: [`production_orders_relOmit`](production_orders_relOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:24836

Omit specific fields from the production_orders_rel

---

### select?

> `optional` **select?**: [`production_orders_relSelect`](production_orders_relSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:24832

Select specific fields to fetch from the production_orders_rel

---

### update

> **update**: [`XOR`](XOR.md)\<[`production_orders_relUpdateInput`](production_orders_relUpdateInput.md), [`production_orders_relUncheckedUpdateInput`](production_orders_relUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:24848

In case the production_orders_rel was found with the provided `where` argument, update it with this data.

---

### where

> **where**: [`production_orders_relWhereUniqueInput`](production_orders_relWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:24840

The filter to search for the production_orders_rel to update in case it exists.
