[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiFeatureFindManyArgs

# Type Alias: AiFeatureFindManyArgs\<ExtArgs\>

> **AiFeatureFindManyArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:33756

AiFeature findMany

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`AiFeatureWhereUniqueInput`](AiFeatureWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:33780

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for listing AiFeatures.

---

### distinct?

> `optional` **distinct?**: [`AiFeatureScalarFieldEnum`](AiFeatureScalarFieldEnum.md) \| [`AiFeatureScalarFieldEnum`](AiFeatureScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:33793

---

### omit?

> `optional` **omit?**: [`AiFeatureOmit`](AiFeatureOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:33764

Omit specific fields from the AiFeature

---

### orderBy?

> `optional` **orderBy?**: [`AiFeatureOrderByWithRelationInput`](AiFeatureOrderByWithRelationInput.md) \| [`AiFeatureOrderByWithRelationInput`](AiFeatureOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:33774

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of AiFeatures to fetch.

---

### select?

> `optional` **select?**: [`AiFeatureSelect`](AiFeatureSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:33760

Select specific fields to fetch from the AiFeature

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:33792

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` AiFeatures.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:33786

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` AiFeatures from the position of the cursor.

---

### where?

> `optional` **where?**: [`AiFeatureWhereInput`](AiFeatureWhereInput.md)

Defined in: generated/prisma/index.d.ts:33768

Filter, which AiFeatures to fetch.
