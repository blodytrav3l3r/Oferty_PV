[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/telemetrySchemas](../README.md) / TelemetryConfigInput

# Type Alias: TelemetryConfigInput

> **TelemetryConfigInput** = `Omit`\<`z.infer`\<*typeof* [`telemetryConfigSchema`](../variables/telemetryConfigSchema.md)\>, `"predictionSnapshot"` \| `"rzDna"` \| `"rzWlazu"` \| `"wellHeight"` \| `"dennicaHeight"`\> & `object`

Defined in: [src/validators/telemetrySchemas.ts:138](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/validators/telemetrySchemas.ts#L138)

## Type Declaration

### dennicaHeight?

> `optional` **dennicaHeight?**: `number`

### predictionSnapshot?

> `optional` **predictionSnapshot?**: `Record`\<`string`, `unknown`\> \| `null`

### rzDna?

> `optional` **rzDna?**: `number`

### rzWlazu?

> `optional` **rzWlazu?**: `number`

### wellHeight?

> `optional` **wellHeight?**: `number`
