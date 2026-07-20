[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../../README.md) / [services/telemetry/learning/ConfidenceCalculator](../README.md) / ConfidenceInput

# Interface: ConfidenceInput

Defined in: [src/services/telemetry/learning/ConfidenceCalculator.ts:8](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/ConfidenceCalculator.ts#L8)

ConfidenceCalculator.ts

Krzywe zaufania dla wzorców w bazie wiedzy.
Wykorzystuje logarytmiczny wzrost + time-decay (pasywne uczenie).

## Properties

### hitCount

> **hitCount**: `number`

Defined in: [src/services/telemetry/learning/ConfidenceCalculator.ts:9](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/ConfidenceCalculator.ts#L9)

---

### lastHitAt?

> `optional` **lastHitAt?**: `string` \| `null`

Defined in: [src/services/telemetry/learning/ConfidenceCalculator.ts:12](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/ConfidenceCalculator.ts#L12)

---

### now?

> `optional` **now?**: `string`

Defined in: [src/services/telemetry/learning/ConfidenceCalculator.ts:13](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/ConfidenceCalculator.ts#L13)

---

### rejectionCount

> **rejectionCount**: `number`

Defined in: [src/services/telemetry/learning/ConfidenceCalculator.ts:11](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/ConfidenceCalculator.ts#L11)

---

### successCount

> **successCount**: `number`

Defined in: [src/services/telemetry/learning/ConfidenceCalculator.ts:10](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/ConfidenceCalculator.ts#L10)
