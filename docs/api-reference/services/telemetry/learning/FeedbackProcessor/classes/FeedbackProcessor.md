[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../../README.md) / [services/telemetry/learning/FeedbackProcessor](../README.md) / FeedbackProcessor

# Class: FeedbackProcessor

Defined in: [src/services/telemetry/learning/FeedbackProcessor.ts:19](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/FeedbackProcessor.ts#L19)

## Constructors

### Constructor

> **new FeedbackProcessor**(): `FeedbackProcessor`

#### Returns

`FeedbackProcessor`

## Methods

### fromBatch()

> **fromBatch**(`events`): [`FeedbackEvent`](../interfaces/FeedbackEvent.md)[]

Defined in: [src/services/telemetry/learning/FeedbackProcessor.ts:76](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/FeedbackProcessor.ts#L76)

Batch - przyjmuje tablicę zdarzeń telemetry.

#### Parameters

##### events

`object`[]

#### Returns

[`FeedbackEvent`](../interfaces/FeedbackEvent.md)[]

***

### fromTelemetryEvent()

> **fromTelemetryEvent**(`event`): [`FeedbackEvent`](../interfaces/FeedbackEvent.md) \| `null`

Defined in: [src/services/telemetry/learning/FeedbackProcessor.ts:23](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/telemetry/learning/FeedbackProcessor.ts#L23)

Mapuje zdarzenia telemetry na FeedbackEvent wewnętrzny.

#### Parameters

##### event

###### changeReason?

`string` \| `null`

###### componentId?

`string` \| `null`

###### createdAt?

`string` \| `null`

###### eventType

`string`

###### newValue?

`string` \| `null`

###### previousValue?

`string` \| `null`

###### telemetryId?

`string` \| `null`

###### wellId?

`string` \| `null`

#### Returns

[`FeedbackEvent`](../interfaces/FeedbackEvent.md) \| `null`
