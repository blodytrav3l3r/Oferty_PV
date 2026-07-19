[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / clients\_relUpdateManyAndReturnArgs

# Type Alias: clients\_relUpdateManyAndReturnArgs\<ExtArgs\>

> **clients\_relUpdateManyAndReturnArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:14325

clients_rel updateManyAndReturn

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`clients_relUpdateManyMutationInput`](clients_relUpdateManyMutationInput.md), [`clients_relUncheckedUpdateManyInput`](clients_relUncheckedUpdateManyInput.md)>\>

Defined in: generated/prisma/index.d.ts:14337

The data used to update clients_rels.

---

### limit?

> `optional` **limit?**: `number`

Defined in: generated/prisma/index.d.ts:14345

Limit how many clients_rels to update.

---

### omit?

> `optional` **omit?**: [`clients_relOmit`](clients_relOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:14333

Omit specific fields from the clients_rel

---

### select?

> `optional` **select?**: [`clients_relSelectUpdateManyAndReturn`](clients_relSelectUpdateManyAndReturn.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:14329

Select specific fields to fetch from the clients_rel

---

### where?

> `optional` **where?**: [`clients_relWhereInput`](clients_relWhereInput.md)

Defined in: generated/prisma/index.d.ts:14341

Filter which clients_rels to update
