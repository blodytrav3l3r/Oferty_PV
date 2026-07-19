[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiModelFindManyArgs

# Type Alias: AiModelFindManyArgs\<ExtArgs\>

> **AiModelFindManyArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:34878

AiModel findMany

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`AiModelWhereUniqueInput`](AiModelWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:34902

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for listing AiModels.

---

### distinct?

> `optional` **distinct?**: [`AiModelScalarFieldEnum`](AiModelScalarFieldEnum.md) \| [`AiModelScalarFieldEnum`](AiModelScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:34915

---

### omit?

> `optional` **omit?**: [`AiModelOmit`](AiModelOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:34886

Omit specific fields from the AiModel

---

### orderBy?

> `optional` **orderBy?**: [`AiModelOrderByWithRelationInput`](AiModelOrderByWithRelationInput.md) \| [`AiModelOrderByWithRelationInput`](AiModelOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:34896

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of AiModels to fetch.

---

### select?

> `optional` **select?**: [`AiModelSelect`](AiModelSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:34882

Select specific fields to fetch from the AiModel

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:34914

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` AiModels.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:34908

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` AiModels from the position of the cursor.

---

### where?

> `optional` **where?**: [`AiModelWhereInput`](AiModelWhereInput.md)

Defined in: generated/prisma/index.d.ts:34890

Filter, which AiModels to fetch.
