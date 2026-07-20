[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../../README.md) / [services/telemetry/learning/ConfidenceCalculator](../README.md) / ConfidenceCalculator

# Class: ConfidenceCalculator

Defined in: [src/services/telemetry/learning/ConfidenceCalculator.ts:16](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/ConfidenceCalculator.ts#L16)

## Constructors

### Constructor

> **new ConfidenceCalculator**(): `ConfidenceCalculator`

#### Returns

`ConfidenceCalculator`

## Properties

### MAX\_CONFIDENCE

> `readonly` **MAX\_CONFIDENCE**: `0.95` = `0.95`

Defined in: [src/services/telemetry/learning/ConfidenceCalculator.ts:20](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/ConfidenceCalculator.ts#L20)

maksymalny confidence (cap)

***

### MIN\_HITS

> `readonly` **MIN\_HITS**: `3` = `3`

Defined in: [src/services/telemetry/learning/ConfidenceCalculator.ts:18](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/ConfidenceCalculator.ts#L18)

minimalna liczba próbek by uznac wzorzec

## Methods

### decay()

> **decay**(`input`): `number`

Defined in: [src/services/telemetry/learning/ConfidenceCalculator.ts:48](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/ConfidenceCalculator.ts#L48)

Decay: confidence spada o 5% za każde 30 dni bez aktywności.

#### Parameters

##### input

[`ConfidenceInput`](../interfaces/ConfidenceInput.md)

#### Returns

`number`

***

### rawConfidence()

> **rawConfidence**(`hitCount`): `number`

Defined in: [src/services/telemetry/learning/ConfidenceCalculator.ts:26](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/ConfidenceCalculator.ts#L26)

Confidence z hit_count z użyciem krzywej logarytmicznej:
3 hits → 0.3, 5 → ~0.5, 10 → ~0.7, 20+ → 0.9+

#### Parameters

##### hitCount

`number`

#### Returns

`number`

***

### weighted()

> **weighted**(`input`): `number`

Defined in: [src/services/telemetry/learning/ConfidenceCalculator.ts:35](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/ConfidenceCalculator.ts#L35)

Confidence z korektą na sukces/odrzucenie.

#### Parameters

##### input

[`ConfidenceInput`](../interfaces/ConfidenceInput.md)

#### Returns

`number`
