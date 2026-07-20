[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../../README.md) / [services/telemetry/learning/FeedbackProcessor](../README.md) / FeedbackEvent

# Interface: FeedbackEvent

Defined in: [src/services/telemetry/learning/FeedbackProcessor.ts:10](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/FeedbackProcessor.ts#L10)

FeedbackProcessor.ts

Przetwarza sygnały zwrotne z telemetry na wewnętrzne "feedback events"
wykorzystywane przez PatternDetector.

Pasywne - nie wpływa na solvera.

## Properties

### at

> **at**: `string`

Defined in: [src/services/telemetry/learning/FeedbackProcessor.ts:16](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/FeedbackProcessor.ts#L16)

---

### details?

> `optional` **details?**: `Record`\<`string`, `unknown`>\>

Defined in: [src/services/telemetry/learning/FeedbackProcessor.ts:15](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/FeedbackProcessor.ts#L15)

---

### dn?

> `optional` **dn?**: `string`

Defined in: [src/services/telemetry/learning/FeedbackProcessor.ts:13](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/FeedbackProcessor.ts#L13)

---

### telemetryId?

> `optional` **telemetryId?**: `string`

Defined in: [src/services/telemetry/learning/FeedbackProcessor.ts:14](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/FeedbackProcessor.ts#L14)

---

### type

> **type**: `"accept"` \| `"reject"` \| `"modify"` \| `"fallback"`

Defined in: [src/services/telemetry/learning/FeedbackProcessor.ts:11](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/FeedbackProcessor.ts#L11)

---

### wellId

> **wellId**: `string`

Defined in: [src/services/telemetry/learning/FeedbackProcessor.ts:12](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/FeedbackProcessor.ts#L12)
