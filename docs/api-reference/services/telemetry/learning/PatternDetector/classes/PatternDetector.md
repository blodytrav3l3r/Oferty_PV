[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../../README.md) / [services/telemetry/learning/PatternDetector](../README.md) / PatternDetector

# Class: PatternDetector

Defined in: [src/services/telemetry/learning/PatternDetector.ts:25](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/PatternDetector.ts#L25)

## Constructors

### Constructor

> **new PatternDetector**(): `PatternDetector`

Defined in: [src/services/telemetry/learning/PatternDetector.ts:29](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/PatternDetector.ts#L29)

#### Returns

`PatternDetector`

## Methods

### detectDennicaSwap()

> **detectDennicaSwap**(`corrections`, `dn`): [`KnowledgePattern`](../../KnowledgeBase/interfaces/KnowledgePattern.md)[]

Defined in: [src/services/telemetry/learning/PatternDetector.ts:37](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/PatternDetector.ts#L37)

Wykrywa wzorce SUBSTITUTION: użytkownik zamienia dennicę/kręg/redukcję.

#### Parameters

##### corrections

`Correction`[]

##### dn

`string`

#### Returns

[`KnowledgePattern`](../../KnowledgeBase/interfaces/KnowledgePattern.md)[]

***

### detectReductionChoice()

> **detectReductionChoice**(`records`): [`KnowledgePattern`](../../KnowledgeBase/interfaces/KnowledgePattern.md)[]

Defined in: [src/services/telemetry/learning/PatternDetector.ts:171](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/PatternDetector.ts#L171)

Wykrywa wzorce REDUCTION CHOICE - kiedy stosowana jest redukcja.

#### Parameters

##### records

`object`[]

#### Returns

[`KnowledgePattern`](../../KnowledgeBase/interfaces/KnowledgePattern.md)[]

***

### detectTransitionLayout()

> **detectTransitionLayout**(`records`): [`KnowledgePattern`](../../KnowledgeBase/interfaces/KnowledgePattern.md)[]

Defined in: [src/services/telemetry/learning/PatternDetector.ts:100](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/PatternDetector.ts#L100)

Wykrywa wzorce TRANSITION layout - najczęściej występujące układy przejść.

#### Parameters

##### records

`object`[]

#### Returns

[`KnowledgePattern`](../../KnowledgeBase/interfaces/KnowledgePattern.md)[]

***

### persist()

> **persist**(`patterns`): `Promise`\<`number`\>

Defined in: [src/services/telemetry/learning/PatternDetector.ts:230](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/PatternDetector.ts#L230)

Persist wykrytych wzorców do KnowledgeBase.

#### Parameters

##### patterns

[`KnowledgePattern`](../../KnowledgeBase/interfaces/KnowledgePattern.md)[]

#### Returns

`Promise`\<`number`\>
