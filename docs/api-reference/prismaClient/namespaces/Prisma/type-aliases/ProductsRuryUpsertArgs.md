[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ProductsRuryUpsertArgs

# Type Alias: ProductsRuryUpsertArgs\<ExtArgs\>

> **ProductsRuryUpsertArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:29967

ProductsRury upsert

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`ProductsRuryCreateInput`](ProductsRuryCreateInput.md), [`ProductsRuryUncheckedCreateInput`](ProductsRuryUncheckedCreateInput.md)>\>

Defined in: generated/prisma/index.d.ts:29987

In case the ProductsRury found by the `where` argument doesn't exist, create a new ProductsRury with this data.

---

### include?

> `optional` **include?**: [`ProductsRuryInclude`](ProductsRuryInclude.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:29979

Choose, which related nodes to fetch as well

---

### omit?

> `optional` **omit?**: [`ProductsRuryOmit`](ProductsRuryOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:29975

Omit specific fields from the ProductsRury

---

### select?

> `optional` **select?**: [`ProductsRurySelect`](ProductsRurySelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:29971

Select specific fields to fetch from the ProductsRury

---

### update

> **update**: [`XOR`](XOR.md)\<[`ProductsRuryUpdateInput`](ProductsRuryUpdateInput.md), [`ProductsRuryUncheckedUpdateInput`](ProductsRuryUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:29991

In case the ProductsRury was found with the provided `where` argument, update it with this data.

---

### where

> **where**: [`ProductsRuryWhereUniqueInput`](ProductsRuryWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:29983

The filter to search for the ProductsRury to update in case it exists.
