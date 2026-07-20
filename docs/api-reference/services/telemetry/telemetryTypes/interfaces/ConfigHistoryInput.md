[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [services/telemetry/telemetryTypes](../README.md) / ConfigHistoryInput

# Interface: ConfigHistoryInput

Defined in: [src/services/telemetry/telemetryTypes.ts:141](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/telemetryTypes.ts#L141)

Model pełnej historii wersji konfiguracji

## Properties

### configJson

> **configJson**: `Record`\<`string`, `unknown`\>

Defined in: [src/services/telemetry/telemetryTypes.ts:145](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/telemetryTypes.ts#L145)

***

### configVersion

> **configVersion**: `number`

Defined in: [src/services/telemetry/telemetryTypes.ts:143](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/telemetryTypes.ts#L143)

***

### diffFromParent?

> `optional` **diffFromParent?**: [`WellComponentSnapshot`](WellComponentSnapshot.md)[]

Defined in: [src/services/telemetry/telemetryTypes.ts:148](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/telemetryTypes.ts#L148)

***

### parentId?

> `optional` **parentId?**: `string`

Defined in: [src/services/telemetry/telemetryTypes.ts:144](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/telemetryTypes.ts#L144)

***

### rankingScore?

> `optional` **rankingScore?**: `number`

Defined in: [src/services/telemetry/telemetryTypes.ts:149](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/telemetryTypes.ts#L149)

***

### selectionReason?

> `optional` **selectionReason?**: `string`

Defined in: [src/services/telemetry/telemetryTypes.ts:150](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/telemetryTypes.ts#L150)

***

### source

> **source**: [`SolverSource`](../type-aliases/SolverSource.md)

Defined in: [src/services/telemetry/telemetryTypes.ts:146](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/telemetryTypes.ts#L146)

***

### triggeredBy?

> `optional` **triggeredBy?**: `string`

Defined in: [src/services/telemetry/telemetryTypes.ts:147](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/telemetryTypes.ts#L147)

***

### wellId

> **wellId**: `string`

Defined in: [src/services/telemetry/telemetryTypes.ts:142](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/telemetryTypes.ts#L142)
