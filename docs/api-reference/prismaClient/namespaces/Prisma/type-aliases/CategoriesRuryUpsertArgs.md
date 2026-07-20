[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / CategoriesRuryUpsertArgs

# Type Alias: CategoriesRuryUpsertArgs\<ExtArgs\>

> **CategoriesRuryUpsertArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:28815

CategoriesRury upsert

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`CategoriesRuryCreateInput`](CategoriesRuryCreateInput.md), [`CategoriesRuryUncheckedCreateInput`](CategoriesRuryUncheckedCreateInput.md)\>

Defined in: generated/prisma/index.d.ts:28835

In case the CategoriesRury found by the `where` argument doesn't exist, create a new CategoriesRury with this data.

***

### include?

> `optional` **include?**: [`CategoriesRuryInclude`](CategoriesRuryInclude.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:28827

Choose, which related nodes to fetch as well

***

### omit?

> `optional` **omit?**: [`CategoriesRuryOmit`](CategoriesRuryOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:28823

Omit specific fields from the CategoriesRury

***

### select?

> `optional` **select?**: [`CategoriesRurySelect`](CategoriesRurySelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:28819

Select specific fields to fetch from the CategoriesRury

***

### update

> **update**: [`XOR`](XOR.md)\<[`CategoriesRuryUpdateInput`](CategoriesRuryUpdateInput.md), [`CategoriesRuryUncheckedUpdateInput`](CategoriesRuryUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:28839

In case the CategoriesRury was found with the provided `where` argument, update it with this data.

***

### where

> **where**: [`CategoriesRuryWhereUniqueInput`](CategoriesRuryWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:28831

The filter to search for the CategoriesRury to update in case it exists.
