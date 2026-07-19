[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../../README.md) / [services/telemetry/learning/LearningEngine](../README.md) / LearningEngine

# Class: LearningEngine

Defined in: [src/services/telemetry/learning/LearningEngine.ts:34](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/LearningEngine.ts#L34)

## Constructors

### Constructor

> **new LearningEngine**(): `LearningEngine`

Defined in: [src/services/telemetry/learning/LearningEngine.ts:45](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/LearningEngine.ts#L45)

#### Returns

`LearningEngine`

## Methods

### getComponents()

> **getComponents**(): `object`

Defined in: [src/services/telemetry/learning/LearningEngine.ts:304](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/LearningEngine.ts#L304)

Dostęp do subkompnentów.

#### Returns

`object`

##### feedback

> **feedback**: [`FeedbackProcessor`](../../FeedbackProcessor/classes/FeedbackProcessor.md)

##### kb

> **kb**: [`KnowledgeBase`](../../KnowledgeBase/classes/KnowledgeBase.md)

##### patterns

> **patterns**: [`PatternDetector`](../../PatternDetector/classes/PatternDetector.md)

##### prefs

> **prefs**: [`PreferenceEngine`](../../PreferenceEngine/classes/PreferenceEngine.md)

##### ranker

> **ranker**: [`RankingEngine`](../../RankingEngine/classes/RankingEngine.md)

##### recommend

> **recommend**: [`RecommendationEngine`](../../RecommendationEngine/classes/RecommendationEngine.md)

---

### getStatus()

> **getStatus**(): `object`

Defined in: [src/services/telemetry/learning/LearningEngine.ts:291](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/LearningEngine.ts#L291)

Zwraca status silniczka.

#### Returns

`object`

##### initialized

> **initialized**: `boolean`

##### lastRunAt

> **lastRunAt**: `string` \| `null`

---

### runFullCycle()

> **runFullCycle**(): `Promise`\<[`LearningRunSummary`](../interfaces/LearningRunSummary.md)>\>

Defined in: [src/services/telemetry/learning/LearningEngine.ts:233](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/LearningEngine.ts#L233)

#### Returns

`Promise`\<[`LearningRunSummary`](../interfaces/LearningRunSummary.md)\>
