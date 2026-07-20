[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_telemetry\_logsFindFirstOrThrowArgs

# Type Alias: ai\_telemetry\_logsFindFirstOrThrowArgs\<ExtArgs\>

> **ai\_telemetry\_logsFindFirstOrThrowArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:5184

ai_telemetry_logs findFirstOrThrow

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`ai_telemetry_logsWhereUniqueInput`](ai_telemetry_logsWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:5208

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for ai_telemetry_logs.

---

### distinct?

> `optional` **distinct?**: [`Ai_telemetry_logsScalarFieldEnum`](Ai_telemetry_logsScalarFieldEnum.md) \| [`Ai_telemetry_logsScalarFieldEnum`](Ai_telemetry_logsScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:5226

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of ai_telemetry_logs.

---

### omit?

> `optional` **omit?**: [`ai_telemetry_logsOmit`](ai_telemetry_logsOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:5192

Omit specific fields from the ai_telemetry_logs

---

### orderBy?

> `optional` **orderBy?**: [`ai_telemetry_logsOrderByWithRelationInput`](ai_telemetry_logsOrderByWithRelationInput.md) \| [`ai_telemetry_logsOrderByWithRelationInput`](ai_telemetry_logsOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:5202

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of ai_telemetry_logs to fetch.

---

### select?

> `optional` **select?**: [`ai_telemetry_logsSelect`](ai_telemetry_logsSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:5188

Select specific fields to fetch from the ai_telemetry_logs

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:5220

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` ai_telemetry_logs.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:5214

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` ai_telemetry_logs from the position of the cursor.

---

### where?

> `optional` **where?**: [`ai_telemetry_logsWhereInput`](ai_telemetry_logsWhereInput.md)

Defined in: generated/prisma/index.d.ts:5196

Filter, which ai_telemetry_logs to fetch.
