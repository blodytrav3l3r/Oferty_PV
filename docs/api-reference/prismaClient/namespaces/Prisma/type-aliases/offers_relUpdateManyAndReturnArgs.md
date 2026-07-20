[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / offers\_relUpdateManyAndReturnArgs

# Type Alias: offers\_relUpdateManyAndReturnArgs\<ExtArgs\>

> **offers\_relUpdateManyAndReturnArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:17565

offers_rel updateManyAndReturn

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`offers_relUpdateManyMutationInput`](offers_relUpdateManyMutationInput.md), [`offers_relUncheckedUpdateManyInput`](offers_relUncheckedUpdateManyInput.md)>\>

Defined in: generated/prisma/index.d.ts:17577

The data used to update offers_rels.

---

### limit?

> `optional` **limit?**: `number`

Defined in: generated/prisma/index.d.ts:17585

Limit how many offers_rels to update.

---

### omit?

> `optional` **omit?**: [`offers_relOmit`](offers_relOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:17573

Omit specific fields from the offers_rel

---

### select?

> `optional` **select?**: [`offers_relSelectUpdateManyAndReturn`](offers_relSelectUpdateManyAndReturn.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:17569

Select specific fields to fetch from the offers_rel

---

### where?

> `optional` **where?**: [`offers_relWhereInput`](offers_relWhereInput.md)

Defined in: generated/prisma/index.d.ts:17581

Filter which offers_rels to update
