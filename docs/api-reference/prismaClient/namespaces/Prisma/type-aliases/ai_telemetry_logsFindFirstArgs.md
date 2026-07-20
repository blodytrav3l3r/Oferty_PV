[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_telemetry\_logsFindFirstArgs

# Type Alias: ai\_telemetry\_logsFindFirstArgs\<ExtArgs\>

> **ai\_telemetry\_logsFindFirstArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:5136

ai_telemetry_logs findFirst

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`ai_telemetry_logsWhereUniqueInput`](ai_telemetry_logsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:5160

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for ai_telemetry_logs.

---

### distinct?

> `optional` **distinct?**: [`Ai_telemetry_logsScalarFieldEnum`](Ai_telemetry_logsScalarFieldEnum.md) \| [`Ai_telemetry_logsScalarFieldEnum`](Ai_telemetry_logsScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:5178

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of ai_telemetry_logs.

---

### omit?

> `optional` **omit?**: [`ai_telemetry_logsOmit`](ai_telemetry_logsOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:5144

Omit specific fields from the ai_telemetry_logs

---

### orderBy?

> `optional` **orderBy?**: [`ai_telemetry_logsOrderByWithRelationInput`](ai_telemetry_logsOrderByWithRelationInput.md) \| [`ai_telemetry_logsOrderByWithRelationInput`](ai_telemetry_logsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:5154

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of ai_telemetry_logs to fetch.

---

### select?

> `optional` **select?**: [`ai_telemetry_logsSelect`](ai_telemetry_logsSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:5140

Select specific fields to fetch from the ai_telemetry_logs

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:5172

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` ai_telemetry_logs.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:5166

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` ai_telemetry_logs from the position of the cursor.

---

### where?

> `optional` **where?**: [`ai_telemetry_logsWhereInput`](ai_telemetry_logsWhereInput.md)

Defined in: generated/prisma/index.d.ts:5148

Filter, which ai_telemetry_logs to fetch.
