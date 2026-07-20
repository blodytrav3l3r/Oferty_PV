[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / recycled\_production\_numbersUpsertArgs

# Type Alias: recycled\_production\_numbersUpsertArgs\<ExtArgs\>

> **recycled\_production\_numbersUpsertArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:25833

recycled_production_numbers upsert

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`recycled_production_numbersCreateInput`](recycled_production_numbersCreateInput.md), [`recycled_production_numbersUncheckedCreateInput`](recycled_production_numbersUncheckedCreateInput.md)>\>

Defined in: generated/prisma/index.d.ts:25849

In case the recycled_production_numbers found by the `where` argument doesn't exist, create a new recycled_production_numbers with this data.

---

### omit?

> `optional` **omit?**: [`recycled_production_numbersOmit`](recycled_production_numbersOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:25841

Omit specific fields from the recycled_production_numbers

---

### select?

> `optional` **select?**: [`recycled_production_numbersSelect`](recycled_production_numbersSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:25837

Select specific fields to fetch from the recycled_production_numbers

---

### update

> **update**: [`XOR`](XOR.md)\<[`recycled_production_numbersUpdateInput`](recycled_production_numbersUpdateInput.md), [`recycled_production_numbersUncheckedUpdateInput`](recycled_production_numbersUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:25853

In case the recycled_production_numbers was found with the provided `where` argument, update it with this data.

---

### where

> **where**: [`recycled_production_numbersWhereUniqueInput`](recycled_production_numbersWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:25845

The filter to search for the recycled_production_numbers to update in case it exists.
