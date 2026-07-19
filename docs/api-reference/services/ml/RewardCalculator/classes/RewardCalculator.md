[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [services/ml/RewardCalculator](../README.md) / RewardCalculator

# Class: RewardCalculator

Defined in: [src/services/ml/RewardCalculator.ts:16](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/ml/RewardCalculator.ts#L16)

## Constructors

### Constructor

> **new RewardCalculator**(): `RewardCalculator`

#### Returns

`RewardCalculator`

## Methods

### getAggregateReward()

> **getAggregateReward**(`userId`): `Promise`\<\{ `count`: `number`; `total`: `number`; \}\>

Defined in: [src/services/ml/RewardCalculator.ts:74](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/ml/RewardCalculator.ts#L74)

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<\{ `count`: `number`; `total`: `number`; \}\>

---

### processAction()

> **processAction**(`event`): `Promise`\<`void`>\>

Defined in: [src/services/ml/RewardCalculator.ts:17](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/ml/RewardCalculator.ts#L17)

#### Parameters

##### event

[`RewardEvent`](../interfaces/RewardEvent.md)

#### Returns

`Promise`\<`void`\>
