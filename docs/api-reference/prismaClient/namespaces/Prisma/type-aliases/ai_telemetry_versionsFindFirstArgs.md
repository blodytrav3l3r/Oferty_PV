[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_telemetry\_versionsFindFirstArgs

# Type Alias: ai\_telemetry\_versionsFindFirstArgs\<ExtArgs\>

> **ai\_telemetry\_versionsFindFirstArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:8429

ai_telemetry_versions findFirst

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`ai_telemetry_versionsWhereUniqueInput`](ai_telemetry_versionsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:8453

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for ai_telemetry_versions.

---

### distinct?

> `optional` **distinct?**: [`Ai_telemetry_versionsScalarFieldEnum`](Ai_telemetry_versionsScalarFieldEnum.md) \| [`Ai_telemetry_versionsScalarFieldEnum`](Ai_telemetry_versionsScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:8471

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of ai_telemetry_versions.

---

### omit?

> `optional` **omit?**: [`ai_telemetry_versionsOmit`](ai_telemetry_versionsOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:8437

Omit specific fields from the ai_telemetry_versions

---

### orderBy?

> `optional` **orderBy?**: [`ai_telemetry_versionsOrderByWithRelationInput`](ai_telemetry_versionsOrderByWithRelationInput.md) \| [`ai_telemetry_versionsOrderByWithRelationInput`](ai_telemetry_versionsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:8447

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of ai_telemetry_versions to fetch.

---

### select?

> `optional` **select?**: [`ai_telemetry_versionsSelect`](ai_telemetry_versionsSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:8433

Select specific fields to fetch from the ai_telemetry_versions

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:8465

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` ai_telemetry_versions.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:8459

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` ai_telemetry_versions from the position of the cursor.

---

### where?

> `optional` **where?**: [`ai_telemetry_versionsWhereInput`](ai_telemetry_versionsWhereInput.md)

Defined in: generated/prisma/index.d.ts:8441

Filter, which ai_telemetry_versions to fetch.
