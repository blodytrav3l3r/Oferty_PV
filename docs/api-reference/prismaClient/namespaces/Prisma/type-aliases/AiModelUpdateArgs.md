[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiModelUpdateArgs

# Type Alias: AiModelUpdateArgs\<ExtArgs\>

> **AiModelUpdateArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:34967

AiModel update

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### data

> **data**: [`XOR`](XOR.md)\<[`AiModelUpdateInput`](AiModelUpdateInput.md), [`AiModelUncheckedUpdateInput`](AiModelUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:34979

The data needed to update a AiModel.

---

### omit?

> `optional` **omit?**: [`AiModelOmit`](AiModelOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:34975

Omit specific fields from the AiModel

---

### select?

> `optional` **select?**: [`AiModelSelect`](AiModelSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:34971

Select specific fields to fetch from the AiModel

---

### where

> **where**: [`AiModelWhereUniqueInput`](AiModelWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:34983

Choose, which AiModel to update.
