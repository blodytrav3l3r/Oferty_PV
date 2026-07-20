[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiEvaluationFindFirstOrThrowArgs

# Type Alias: AiEvaluationFindFirstOrThrowArgs\<ExtArgs\>

> **AiEvaluationFindFirstOrThrowArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:35895

AiEvaluation findFirstOrThrow

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`AiEvaluationWhereUniqueInput`](AiEvaluationWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:35919

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for AiEvaluations.

***

### distinct?

> `optional` **distinct?**: [`AiEvaluationScalarFieldEnum`](AiEvaluationScalarFieldEnum.md) \| [`AiEvaluationScalarFieldEnum`](AiEvaluationScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:35937

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of AiEvaluations.

***

### omit?

> `optional` **omit?**: [`AiEvaluationOmit`](AiEvaluationOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:35903

Omit specific fields from the AiEvaluation

***

### orderBy?

> `optional` **orderBy?**: [`AiEvaluationOrderByWithRelationInput`](AiEvaluationOrderByWithRelationInput.md) \| [`AiEvaluationOrderByWithRelationInput`](AiEvaluationOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:35913

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of AiEvaluations to fetch.

***

### select?

> `optional` **select?**: [`AiEvaluationSelect`](AiEvaluationSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:35899

Select specific fields to fetch from the AiEvaluation

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:35931

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` AiEvaluations.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:35925

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` AiEvaluations from the position of the cursor.

***

### where?

> `optional` **where?**: [`AiEvaluationWhereInput`](AiEvaluationWhereInput.md)

Defined in: generated/prisma/index.d.ts:35907

Filter, which AiEvaluation to fetch.
