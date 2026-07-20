[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiEvaluationFindManyArgs

# Type Alias: AiEvaluationFindManyArgs\<ExtArgs\>

> **AiEvaluationFindManyArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:35943

AiEvaluation findMany

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`AiEvaluationWhereUniqueInput`](AiEvaluationWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:35967

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for listing AiEvaluations.

---

### distinct?

> `optional` **distinct?**: [`AiEvaluationScalarFieldEnum`](AiEvaluationScalarFieldEnum.md) \| [`AiEvaluationScalarFieldEnum`](AiEvaluationScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:35980

---

### omit?

> `optional` **omit?**: [`AiEvaluationOmit`](AiEvaluationOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:35951

Omit specific fields from the AiEvaluation

---

### orderBy?

> `optional` **orderBy?**: [`AiEvaluationOrderByWithRelationInput`](AiEvaluationOrderByWithRelationInput.md) \| [`AiEvaluationOrderByWithRelationInput`](AiEvaluationOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:35961

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of AiEvaluations to fetch.

---

### select?

> `optional` **select?**: [`AiEvaluationSelect`](AiEvaluationSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:35947

Select specific fields to fetch from the AiEvaluation

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:35979

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` AiEvaluations.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:35973

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` AiEvaluations from the position of the cursor.

---

### where?

> `optional` **where?**: [`AiEvaluationWhereInput`](AiEvaluationWhereInput.md)

Defined in: generated/prisma/index.d.ts:35955

Filter, which AiEvaluations to fetch.
