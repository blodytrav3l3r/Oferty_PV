[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../../README.md) / [services/telemetry/learning/RecommendationEngine](../README.md) / RecommendationEngine

# Class: RecommendationEngine

Defined in: [src/services/telemetry/learning/RecommendationEngine.ts:26](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/RecommendationEngine.ts#L26)

## Constructors

### Constructor

> **new RecommendationEngine**(): `RecommendationEngine`

Defined in: [src/services/telemetry/learning/RecommendationEngine.ts:30](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/RecommendationEngine.ts#L30)

#### Returns

`RecommendationEngine`

## Methods

### applyDecision()

> **applyDecision**(`id`, `accepted`, `decidedBy`): `Promise`\<`void`\>

Defined in: [src/services/telemetry/learning/RecommendationEngine.ts:98](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/RecommendationEngine.ts#L98)

Decyzja acceptance/rejection rekomendacji.

#### Parameters

##### id

`string`

##### accepted

`boolean`

##### decidedBy

`string`

#### Returns

`Promise`\<`void`\>

***

### persistRecommendation()

> **persistRecommendation**(`input`): `Promise`\<`string`\>

Defined in: [src/services/telemetry/learning/RecommendationEngine.ts:75](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/RecommendationEngine.ts#L75)

Zapis rekomendacji do tabeli ai_recommendations.

#### Parameters

##### input

###### confidence

`number`

###### dn?

`string`

###### patternKey

`string`

###### patternType

`string`

###### payload?

`Record`\<`string`, `unknown`\>

###### score

`number`

###### wellId?

`string`

#### Returns

`Promise`\<`string`\>

***

### recommendForDn()

> **recommendForDn**(`features`, `topN?`): `Promise`\<[`RankedRecommendation`](../../RankingEngine/interfaces/RankedRecommendation.md)[]\>

Defined in: [src/services/telemetry/learning/RecommendationEngine.ts:67](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/RecommendationEngine.ts#L67)

Zwróć najlepsze wzorce dla danego DN z features.

#### Parameters

##### features

[`FeatureVector`](../../types/interfaces/FeatureVector.md)

##### topN?

`number` = `5`

#### Returns

`Promise`\<[`RankedRecommendation`](../../RankingEngine/interfaces/RankedRecommendation.md)[]\>

***

### recommendForTelemetry()

> **recommendForTelemetry**(`telemetryId`, `dn?`): `Promise`\<[`TopRecommendation`](../interfaces/TopRecommendation.md)[]\>

Defined in: [src/services/telemetry/learning/RecommendationEngine.ts:38](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/RecommendationEngine.ts#L38)

Zwraca rekomendacje dla podanego rekordu telemetry.

#### Parameters

##### telemetryId

`string`

##### dn?

`string`

#### Returns

`Promise`\<[`TopRecommendation`](../interfaces/TopRecommendation.md)[]\>
