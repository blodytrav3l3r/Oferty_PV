[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../../README.md) / [services/telemetry/learning/KnowledgeBase](../README.md) / KnowledgeBase

# Class: KnowledgeBase

Defined in: [src/services/telemetry/learning/KnowledgeBase.ts:47](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/KnowledgeBase.ts#L47)

## Constructors

### Constructor

> **new KnowledgeBase**(): `KnowledgeBase`

#### Returns

`KnowledgeBase`

## Methods

### archivePattern()

> **archivePattern**(`id`): `Promise`\<`void`>\>

Defined in: [src/services/telemetry/learning/KnowledgeBase.ts:297](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/KnowledgeBase.ts#L297)

Oznacz wzorzec jako 'stale' (nieużywany od dawna).

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

---

### decideRecommendation()

> **decideRecommendation**(`id`, `accepted`, `decidedBy`): `Promise`\<`void`>\>

Defined in: [src/services/telemetry/learning/KnowledgeBase.ts:191](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/KnowledgeBase.ts#L191)

Oznacz rekomendację jako zaakceptowaną/odrzuconą (pasywne — nie wpływa na solver).

#### Parameters

##### id

`string`

##### accepted

`boolean`

##### decidedBy

`string`

#### Returns

`Promise`\<`void`\>

---

### getPatternsForDn()

> **getPatternsForDn**(`dn`, `minConfidence?`): `Promise`\<[`KnowledgePattern`](../interfaces/KnowledgePattern.md)[]\>

Defined in: [src/services/telemetry/learning/KnowledgeBase.ts:128](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/KnowledgeBase.ts#L128)

Lista wzorców wg DN (do rekomendacji).

#### Parameters

##### dn

`string`

##### minConfidence?

`number` = `0.3`

#### Returns

`Promise`\<[`KnowledgePattern`](../interfaces/KnowledgePattern.md)[]\>

---

### getStats()

> **getStats**(): `Promise`\<\{ `acceptedRecommendations`: `number`; `active`: `number`; `archived`: `number`; `avgConfidence`: `number`; `byPatternType`: `Record`\<`string`, `number`>\>; `recentDetected`: `number`; `rejectedRecommendations`: `number`; `stale`: `number`; `total`: `number`; `totalRecommendations`: `number`; \}\>

Defined in: [src/services/telemetry/learning/KnowledgeBase.ts:210](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/KnowledgeBase.ts#L210)

Statystyki bazy wiedzy do dashboardu.

#### Returns

`Promise`\<\{ `acceptedRecommendations`: `number`; `active`: `number`; `archived`: `number`; `avgConfidence`: `number`; `byPatternType`: `Record`\<`string`, `number`\>; `recentDetected`: `number`; `rejectedRecommendations`: `number`; `stale`: `number`; `total`: `number`; `totalRecommendations`: `number`; \}\>

---

### recordRecommendation()

> **recordRecommendation**(`rec`): `Promise`\<`string`>\>

Defined in: [src/services/telemetry/learning/KnowledgeBase.ts:164](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/KnowledgeBase.ts#L164)

Zapis rekomendacji w tabeli.

#### Parameters

##### rec

[`RecommendationRecord`](../interfaces/RecommendationRecord.md)

#### Returns

`Promise`\<`string`\>

---

### upsertPattern()

> **upsertPattern**(`pattern`): `Promise`\<`string`>\>

Defined in: [src/services/telemetry/learning/KnowledgeBase.ts:51](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/KnowledgeBase.ts#L51)

Upsert wzorca - jeśli patternKey istnieje, aktualizuj; wpp wstaw.

#### Parameters

##### pattern

[`KnowledgePattern`](../interfaces/KnowledgePattern.md)

#### Returns

`Promise`\<`string`\>
