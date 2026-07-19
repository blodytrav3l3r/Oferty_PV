[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/telemetrySchemas](../README.md) / TelemetryConfigInput

# Type Alias: TelemetryConfigInput

> **TelemetryConfigInput** = `Omit`\<`z.infer`\<_typeof_ [`telemetryConfigSchema`](../variables/telemetryConfigSchema.md)>\>, `"predictionSnapshot"` \| `"rzDna"` \| `"rzWlazu"` \| `"wellHeight"` \| `"dennicaHeight"`> \> & `object`

Defined in: [src/validators/telemetrySchemas.ts:138](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/validators/telemetrySchemas.ts#L138)

## Type Declaration

### dennicaHeight?

> `optional` **dennicaHeight?**: `number`

### predictionSnapshot?

> `optional` **predictionSnapshot?**: `Record`\<`string`, `unknown`> \> \| `null`

### rzDna?

> `optional` **rzDna?**: `number`

### rzWlazu?

> `optional` **rzWlazu?**: `number`

### wellHeight?

> `optional` **wellHeight?**: `number`
