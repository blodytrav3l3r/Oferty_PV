[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiModelFindFirstOrThrowArgs

# Type Alias: AiModelFindFirstOrThrowArgs\<ExtArgs\>

> **AiModelFindFirstOrThrowArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:34830

AiModel findFirstOrThrow

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`AiModelWhereUniqueInput`](AiModelWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:34854

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for AiModels.

---

### distinct?

> `optional` **distinct?**: [`AiModelScalarFieldEnum`](AiModelScalarFieldEnum.md) \| [`AiModelScalarFieldEnum`](AiModelScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:34872

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of AiModels.

---

### omit?

> `optional` **omit?**: [`AiModelOmit`](AiModelOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:34838

Omit specific fields from the AiModel

---

### orderBy?

> `optional` **orderBy?**: [`AiModelOrderByWithRelationInput`](AiModelOrderByWithRelationInput.md) \| [`AiModelOrderByWithRelationInput`](AiModelOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:34848

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of AiModels to fetch.

---

### select?

> `optional` **select?**: [`AiModelSelect`](AiModelSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:34834

Select specific fields to fetch from the AiModel

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:34866

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` AiModels.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:34860

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` AiModels from the position of the cursor.

---

### where?

> `optional` **where?**: [`AiModelWhereInput`](AiModelWhereInput.md)

Defined in: generated/prisma/index.d.ts:34842

Filter, which AiModel to fetch.
