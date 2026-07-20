[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [services/ml/FeatureExtractor](../README.md) / FeatureExtractor

# Class: FeatureExtractor

Defined in: [src/services/ml/FeatureExtractor.ts:97](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/ml/FeatureExtractor.ts#L97)

## Constructors

### Constructor

> **new FeatureExtractor**(): `FeatureExtractor`

#### Returns

`FeatureExtractor`

## Methods

### extract()

> **extract**(`record`): [`FeatureVector`](../interfaces/FeatureVector.md)

Defined in: [src/services/ml/FeatureExtractor.ts:157](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/ml/FeatureExtractor.ts#L157)

#### Parameters

##### record

[`TelemetryRecordWithDetails`](../interfaces/TelemetryRecordWithDetails.md)

#### Returns

[`FeatureVector`](../interfaces/FeatureVector.md)

***

### extractAndStore()

> **extractAndStore**(): `Promise`\<`number`\>

Defined in: [src/services/ml/FeatureExtractor.ts:98](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/ml/FeatureExtractor.ts#L98)

#### Returns

`Promise`\<`number`\>

***

### getFeatureCount()

> **getFeatureCount**(): `Promise`\<`number`\>

Defined in: [src/services/ml/FeatureExtractor.ts:244](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/ml/FeatureExtractor.ts#L244)

#### Returns

`Promise`\<`number`\>
