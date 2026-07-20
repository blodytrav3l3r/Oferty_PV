[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [services/ml/ModelRegistry](../README.md) / ModelRegistry

# Class: ModelRegistry

Defined in: [src/services/ml/ModelRegistry.ts:30](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/ml/ModelRegistry.ts#L30)

## Constructors

### Constructor

> **new ModelRegistry**(): `ModelRegistry`

#### Returns

`ModelRegistry`

## Methods

### getActiveModel()

> **getActiveModel**(): `Promise`\<[`StoredModel`](../interfaces/StoredModel.md) \| `null`>\>

Defined in: [src/services/ml/ModelRegistry.ts:79](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/ml/ModelRegistry.ts#L79)

#### Returns

`Promise`\<[`StoredModel`](../interfaces/StoredModel.md) \| `null`\>

---

### getModelByVersion()

> **getModelByVersion**(`version`): `Promise`\<[`StoredModel`](../interfaces/StoredModel.md) \| `null`>\>

Defined in: [src/services/ml/ModelRegistry.ts:85](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/ml/ModelRegistry.ts#L85)

#### Parameters

##### version

`string`

#### Returns

`Promise`\<[`StoredModel`](../interfaces/StoredModel.md) \| `null`\>

---

### getModelCount()

> **getModelCount**(): `Promise`\<`number`>\>

Defined in: [src/services/ml/ModelRegistry.ts:118](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/ml/ModelRegistry.ts#L118)

#### Returns

`Promise`\<`number`\>

---

### listModels()

> **listModels**(`limit?`): `Promise`\<[`StoredModel`](../interfaces/StoredModel.md)[]\>

Defined in: [src/services/ml/ModelRegistry.ts:91](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/ml/ModelRegistry.ts#L91)

#### Parameters

##### limit?

`number` = `20`

#### Returns

`Promise`\<[`StoredModel`](../interfaces/StoredModel.md)[]\>

---

### rollbackToPrevious()

> **rollbackToPrevious**(): `Promise`\<[`StoredModel`](../interfaces/StoredModel.md) \| `null`>\>

Defined in: [src/services/ml/ModelRegistry.ts:99](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/ml/ModelRegistry.ts#L99)

#### Returns

`Promise`\<[`StoredModel`](../interfaces/StoredModel.md) \| `null`\>

---

### saveModel()

> **saveModel**(`model`, `metrics`, `features`, `featureMins`, `featureMaxs`, `shouldActivate`, `notes?`): `Promise`\<`string`>\>

Defined in: [src/services/ml/ModelRegistry.ts:31](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/ml/ModelRegistry.ts#L31)

#### Parameters

##### model

[`AcceptanceModel`](../../AcceptanceModel/classes/AcceptanceModel.md)

##### metrics

[`ModelMetrics`](../interfaces/ModelMetrics.md)

##### features

`string`[]

##### featureMins

`number`[]

##### featureMaxs

`number`[]

##### shouldActivate

`boolean`

##### notes?

`string`

#### Returns

`Promise`\<`string`\>
