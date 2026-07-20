[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiFeatureFindFirstArgs

# Type Alias: AiFeatureFindFirstArgs\<ExtArgs\>

> **AiFeatureFindFirstArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:33660

AiFeature findFirst

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`AiFeatureWhereUniqueInput`](AiFeatureWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:33684

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for AiFeatures.

---

### distinct?

> `optional` **distinct?**: [`AiFeatureScalarFieldEnum`](AiFeatureScalarFieldEnum.md) \| [`AiFeatureScalarFieldEnum`](AiFeatureScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:33702

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of AiFeatures.

---

### omit?

> `optional` **omit?**: [`AiFeatureOmit`](AiFeatureOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:33668

Omit specific fields from the AiFeature

---

### orderBy?

> `optional` **orderBy?**: [`AiFeatureOrderByWithRelationInput`](AiFeatureOrderByWithRelationInput.md) \| [`AiFeatureOrderByWithRelationInput`](AiFeatureOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:33678

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of AiFeatures to fetch.

---

### select?

> `optional` **select?**: [`AiFeatureSelect`](AiFeatureSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:33664

Select specific fields to fetch from the AiFeature

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:33696

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` AiFeatures.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:33690

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` AiFeatures from the position of the cursor.

---

### where?

> `optional` **where?**: [`AiFeatureWhereInput`](AiFeatureWhereInput.md)

Defined in: generated/prisma/index.d.ts:33672

Filter, which AiFeature to fetch.
