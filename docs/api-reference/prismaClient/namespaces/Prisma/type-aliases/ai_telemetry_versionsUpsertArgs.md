[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_telemetry\_versionsUpsertArgs

# Type Alias: ai\_telemetry\_versionsUpsertArgs\<ExtArgs\>

> **ai\_telemetry\_versionsUpsertArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:8680

ai_telemetry_versions upsert

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### create

> **create**: [`XOR`](XOR.md)\<[`ai_telemetry_versionsCreateInput`](ai_telemetry_versionsCreateInput.md), [`ai_telemetry_versionsUncheckedCreateInput`](ai_telemetry_versionsUncheckedCreateInput.md)>\>

Defined in: generated/prisma/index.d.ts:8696

In case the ai_telemetry_versions found by the `where` argument doesn't exist, create a new ai_telemetry_versions with this data.

---

### omit?

> `optional` **omit?**: [`ai_telemetry_versionsOmit`](ai_telemetry_versionsOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:8688

Omit specific fields from the ai_telemetry_versions

---

### select?

> `optional` **select?**: [`ai_telemetry_versionsSelect`](ai_telemetry_versionsSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:8684

Select specific fields to fetch from the ai_telemetry_versions

---

### update

> **update**: [`XOR`](XOR.md)\<[`ai_telemetry_versionsUpdateInput`](ai_telemetry_versionsUpdateInput.md), [`ai_telemetry_versionsUncheckedUpdateInput`](ai_telemetry_versionsUncheckedUpdateInput.md)>\>

Defined in: generated/prisma/index.d.ts:8700

In case the ai_telemetry_versions was found with the provided `where` argument, update it with this data.

---

### where

> **where**: [`ai_telemetry_versionsWhereUniqueInput`](ai_telemetry_versionsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:8692

The filter to search for the ai_telemetry_versions to update in case it exists.
