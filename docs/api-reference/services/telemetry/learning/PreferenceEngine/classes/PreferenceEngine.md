[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../../README.md) / [services/telemetry/learning/PreferenceEngine](../README.md) / PreferenceEngine

# Class: PreferenceEngine

Defined in: [src/services/telemetry/learning/PreferenceEngine.ts:20](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/PreferenceEngine.ts#L20)

## Constructors

### Constructor

> **new PreferenceEngine**(): `PreferenceEngine`

Defined in: [src/services/telemetry/learning/PreferenceEngine.ts:23](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/PreferenceEngine.ts#L23)

#### Returns

`PreferenceEngine`

## Methods

### buildAddition()

> **buildAddition**(`corrections`): [`KnowledgePattern`](../../KnowledgeBase/interfaces/KnowledgePattern.md)[]

Defined in: [src/services/telemetry/learning/PreferenceEngine.ts:74](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/PreferenceEngine.ts#L74)

Preferencje ADDITION - użytkownik dodaje dodatkowy element.

#### Parameters

##### corrections

`CorrectionRaw`[]

#### Returns

[`KnowledgePattern`](../../KnowledgeBase/interfaces/KnowledgePattern.md)[]

---

### buildRemoval()

> **buildRemoval**(`corrections`): [`KnowledgePattern`](../../KnowledgeBase/interfaces/KnowledgePattern.md)[]

Defined in: [src/services/telemetry/learning/PreferenceEngine.ts:111](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/PreferenceEngine.ts#L111)

Preferencje REMOVAL - użytkownik usuwa element.

#### Parameters

##### corrections

`CorrectionRaw`[]

#### Returns

[`KnowledgePattern`](../../KnowledgeBase/interfaces/KnowledgePattern.md)[]

---

### buildSubstitution()

> **buildSubstitution**(`corrections`): [`KnowledgePattern`](../../KnowledgeBase/interfaces/KnowledgePattern.md)[]

Defined in: [src/services/telemetry/learning/PreferenceEngine.ts:30](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/telemetry/learning/PreferenceEngine.ts#L30)

Analizuje korekt i buduje preferencje SUBSTITUTION (zamiana X→Y).

#### Parameters

##### corrections

`CorrectionRaw`[]

#### Returns

[`KnowledgePattern`](../../KnowledgeBase/interfaces/KnowledgePattern.md)[]
