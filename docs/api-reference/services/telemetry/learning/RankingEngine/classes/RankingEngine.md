[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../../README.md) / [services/telemetry/learning/RankingEngine](../README.md) / RankingEngine

# Class: RankingEngine

Defined in: [src/services/telemetry/learning/RankingEngine.ts:17](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/RankingEngine.ts#L17)

## Constructors

### Constructor

> **new RankingEngine**(): `RankingEngine`

#### Returns

`RankingEngine`

## Methods

### \_score()

> **\_score**(`features`, `pattern`): [`RankedRecommendation`](../interfaces/RankedRecommendation.md)

Defined in: [src/services/telemetry/learning/RankingEngine.ts:37](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/RankingEngine.ts#L37)

Score kombinacja confidence + match cech geometrycznych z features.

#### Parameters

##### features

[`FeatureVector`](../../types/interfaces/FeatureVector.md)

##### pattern

[`KnowledgePattern`](../../KnowledgeBase/interfaces/KnowledgePattern.md)

#### Returns

[`RankedRecommendation`](../interfaces/RankedRecommendation.md)

***

### rank()

> **rank**(`features`, `patterns`, `topN?`): [`RankedRecommendation`](../interfaces/RankedRecommendation.md)[]

Defined in: [src/services/telemetry/learning/RankingEngine.ts:21](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/RankingEngine.ts#L21)

Rankinguje wzorce dla danego rekordu telemetry.

#### Parameters

##### features

[`FeatureVector`](../../types/interfaces/FeatureVector.md)

##### patterns

[`KnowledgePattern`](../../KnowledgeBase/interfaces/KnowledgePattern.md)[]

##### topN?

`number` = `5`

#### Returns

[`RankedRecommendation`](../interfaces/RankedRecommendation.md)[]
