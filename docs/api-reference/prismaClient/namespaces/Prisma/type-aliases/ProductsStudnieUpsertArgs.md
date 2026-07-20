[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ProductsStudnieUpsertArgs

# Type Alias: ProductsStudnieUpsertArgs\<ExtArgs\>

> **ProductsStudnieUpsertArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:32615

ProductsStudnie upsert

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`ProductsStudnieCreateInput`](ProductsStudnieCreateInput.md), [`ProductsStudnieUncheckedCreateInput`](ProductsStudnieUncheckedCreateInput.md)\>

Defined in: generated/prisma/index.d.ts:32635

In case the ProductsStudnie found by the `where` argument doesn't exist, create a new ProductsStudnie with this data.

***

### include?

> `optional` **include?**: [`ProductsStudnieInclude`](ProductsStudnieInclude.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:32627

Choose, which related nodes to fetch as well

***

### omit?

> `optional` **omit?**: [`ProductsStudnieOmit`](ProductsStudnieOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:32623

Omit specific fields from the ProductsStudnie

***

### select?

> `optional` **select?**: [`ProductsStudnieSelect`](ProductsStudnieSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:32619

Select specific fields to fetch from the ProductsStudnie

***

### update

> **update**: [`XOR`](XOR.md)\<[`ProductsStudnieUpdateInput`](ProductsStudnieUpdateInput.md), [`ProductsStudnieUncheckedUpdateInput`](ProductsStudnieUncheckedUpdateInput.md)\>

Defined in: generated/prisma/index.d.ts:32639

In case the ProductsStudnie was found with the provided `where` argument, update it with this data.

***

### where

> **where**: [`ProductsStudnieWhereUniqueInput`](ProductsStudnieWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:32631

The filter to search for the ProductsStudnie to update in case it exists.
