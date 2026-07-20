[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [services/ml/TrainingPipeline](../README.md) / TrainingPipeline

# Class: TrainingPipeline

Defined in: [src/services/ml/TrainingPipeline.ts:81](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/ml/TrainingPipeline.ts#L81)

## Constructors

### Constructor

> **new TrainingPipeline**(): `TrainingPipeline`

#### Returns

`TrainingPipeline`

## Methods

### getStatus()

> **getStatus**(): `object`

Defined in: [src/services/ml/TrainingPipeline.ts:281](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/ml/TrainingPipeline.ts#L281)

#### Returns

`object`

##### running

> **running**: `boolean`

---

### run()

> **run**(`force?`): `Promise`\<\{ `metrics?`: [`ModelMetrics`](../../ModelRegistry/interfaces/ModelMetrics.md); `reason?`: `string`; `trained`: `boolean`; `version?`: `string`; \}\>

Defined in: [src/services/ml/TrainingPipeline.ts:101](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/ml/TrainingPipeline.ts#L101)

#### Parameters

##### force?

`boolean` = `false`

#### Returns

`Promise`\<\{ `metrics?`: [`ModelMetrics`](../../ModelRegistry/interfaces/ModelMetrics.md); `reason?`: `string`; `trained`: `boolean`; `version?`: `string`; \}\>
