[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / production\_orders\_relUpdateManyAndReturnArgs

# Type Alias: production\_orders\_relUpdateManyAndReturnArgs\<ExtArgs\>

> **production\_orders\_relUpdateManyAndReturnArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:24802

production_orders_rel updateManyAndReturn

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`production_orders_relUpdateManyMutationInput`](production_orders_relUpdateManyMutationInput.md), [`production_orders_relUncheckedUpdateManyInput`](production_orders_relUncheckedUpdateManyInput.md)>\>

Defined in: generated/prisma/index.d.ts:24814

The data used to update production_orders_rels.

---

### limit?

> `optional` **limit?**: `number`

Defined in: generated/prisma/index.d.ts:24822

Limit how many production_orders_rels to update.

---

### omit?

> `optional` **omit?**: [`production_orders_relOmit`](production_orders_relOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:24810

Omit specific fields from the production_orders_rel

---

### select?

> `optional` **select?**: [`production_orders_relSelectUpdateManyAndReturn`](production_orders_relSelectUpdateManyAndReturn.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:24806

Select specific fields to fetch from the production_orders_rel

---

### where?

> `optional` **where?**: [`production_orders_relWhereInput`](production_orders_relWhereInput.md)

Defined in: generated/prisma/index.d.ts:24818

Filter which production_orders_rels to update
