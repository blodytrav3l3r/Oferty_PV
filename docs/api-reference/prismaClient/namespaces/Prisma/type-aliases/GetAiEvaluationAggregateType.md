[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAiEvaluationAggregateType

# Type Alias: GetAiEvaluationAggregateType\<T\>

> **GetAiEvaluationAggregateType**\<`T`\> = \{ \[P in keyof T & keyof AggregateAiEvaluation\]: P extends "\_count" \| "count" ? T\[P\] extends true ? number : GetScalarType\<T\[P\], AggregateAiEvaluation\[P\]\> : GetScalarType\<T\[P\], AggregateAiEvaluation\[P\]\> \}

Defined in: generated/prisma/index.d.ts:35267

## Type Parameters

### T

`T` *extends* [`AiEvaluationAggregateArgs`](AiEvaluationAggregateArgs.md)
