[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / CategoriesStudnieUpsertArgs

# Type Alias: CategoriesStudnieUpsertArgs\<ExtArgs\>

> **CategoriesStudnieUpsertArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:31019

CategoriesStudnie upsert

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`CategoriesStudnieCreateInput`](CategoriesStudnieCreateInput.md), [`CategoriesStudnieUncheckedCreateInput`](CategoriesStudnieUncheckedCreateInput.md)>\>

Defined in: generated/prisma/index.d.ts:31039

In case the CategoriesStudnie found by the `where` argument doesn't exist, create a new CategoriesStudnie with this data.

---

### include?

> `optional` **include?**: [`CategoriesStudnieInclude`](CategoriesStudnieInclude.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:31031

Choose, which related nodes to fetch as well

---

### omit?

> `optional` **omit?**: [`CategoriesStudnieOmit`](CategoriesStudnieOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:31027

Omit specific fields from the CategoriesStudnie

---

### select?

> `optional` **select?**: [`CategoriesStudnieSelect`](CategoriesStudnieSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:31023

Select specific fields to fetch from the CategoriesStudnie

---

### update

> **update**: [`XOR`](XOR.md)\<[`CategoriesStudnieUpdateInput`](CategoriesStudnieUpdateInput.md), [`CategoriesStudnieUncheckedUpdateInput`](CategoriesStudnieUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:31043

In case the CategoriesStudnie was found with the provided `where` argument, update it with this data.

---

### where

> **where**: [`CategoriesStudnieWhereUniqueInput`](CategoriesStudnieWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:31035

The filter to search for the CategoriesStudnie to update in case it exists.
