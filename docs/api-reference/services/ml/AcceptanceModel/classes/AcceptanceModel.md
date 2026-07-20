[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [services/ml/AcceptanceModel](../README.md) / AcceptanceModel

# Class: AcceptanceModel

Defined in: [src/services/ml/AcceptanceModel.ts:7](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/ml/AcceptanceModel.ts#L7)

## Constructors

### Constructor

> **new AcceptanceModel**(`featureCount`, `weights?`, `bias?`): `AcceptanceModel`

Defined in: [src/services/ml/AcceptanceModel.ts:12](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/ml/AcceptanceModel.ts#L12)

#### Parameters

##### featureCount

`number`

##### weights?

`number`[]

##### bias?

`number`

#### Returns

`AcceptanceModel`

## Methods

### getBias()

> **getBias**(): `number`

Defined in: [src/services/ml/AcceptanceModel.ts:72](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/ml/AcceptanceModel.ts#L72)

#### Returns

`number`

***

### getFeatureCount()

> **getFeatureCount**(): `number`

Defined in: [src/services/ml/AcceptanceModel.ts:76](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/ml/AcceptanceModel.ts#L76)

#### Returns

`number`

***

### getWeights()

> **getWeights**(): `number`[]

Defined in: [src/services/ml/AcceptanceModel.ts:68](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/ml/AcceptanceModel.ts#L68)

#### Returns

`number`[]

***

### predict()

> **predict**(`features`): `number`

Defined in: [src/services/ml/AcceptanceModel.ts:24](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/ml/AcceptanceModel.ts#L24)

#### Parameters

##### features

`number`[]

#### Returns

`number`

***

### predictBatch()

> **predictBatch**(`featuresList`): `number`[]

Defined in: [src/services/ml/AcceptanceModel.ts:32](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/ml/AcceptanceModel.ts#L32)

#### Parameters

##### featuresList

`number`[][]

#### Returns

`number`[]

***

### sigmoid()

> **sigmoid**(`z`): `number`

Defined in: [src/services/ml/AcceptanceModel.ts:18](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/ml/AcceptanceModel.ts#L18)

#### Parameters

##### z

`number`

#### Returns

`number`

***

### train()

> **train**(`dataset`, `learningRate`, `epochs`, `l2Lambda?`): `void`

Defined in: [src/services/ml/AcceptanceModel.ts:36](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/ml/AcceptanceModel.ts#L36)

#### Parameters

##### dataset

[`TrainingExample`](../interfaces/TrainingExample.md)[]

##### learningRate

`number`

##### epochs

`number`

##### l2Lambda?

`number` = `0.01`

#### Returns

`void`
