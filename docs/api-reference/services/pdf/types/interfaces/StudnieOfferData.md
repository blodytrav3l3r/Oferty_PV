[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [services/pdf/types](../README.md) / StudnieOfferData

# Interface: StudnieOfferData

Defined in: [src/services/pdf/types.ts:30](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L30)

## Properties

### authorUser?

> `optional` **authorUser?**: [`UserContactInfo`](UserContactInfo.md) \| `null`

Defined in: [src/services/pdf/types.ts:59](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L59)

***

### clientAddress

> **clientAddress**: `string`

Defined in: [src/services/pdf/types.ts:38](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L38)

***

### clientName

> **clientName**: `string`

Defined in: [src/services/pdf/types.ts:36](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L36)

***

### clientNip

> **clientNip**: `string`

Defined in: [src/services/pdf/types.ts:37](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L37)

***

### clientPhone

> **clientPhone**: `string`

Defined in: [src/services/pdf/types.ts:39](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L39)

***

### createdAt

> **createdAt**: `string`

Defined in: [src/services/pdf/types.ts:54](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L54)

***

### documentType?

> `optional` **documentType?**: `"offer"` \| `"order"`

Defined in: [src/services/pdf/types.ts:32](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L32)

***

### guardianUser?

> `optional` **guardianUser?**: [`UserContactInfo`](UserContactInfo.md) \| `null`

Defined in: [src/services/pdf/types.ts:60](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L60)

***

### investAddress

> **investAddress**: `string`

Defined in: [src/services/pdf/types.ts:41](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L41)

***

### investName

> **investName**: `string`

Defined in: [src/services/pdf/types.ts:40](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L40)

***

### items

> **items**: `object`[]

Defined in: [src/services/pdf/types.ts:42](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L42)

#### discount?

> `optional` **discount?**: `number` \| `null`

#### DN?

> `optional` **DN?**: `string` \| `null`

#### dodatkowe\_info?

> `optional` **dodatkowe\_info?**: `string` \| `null`

#### height?

> `optional` **height?**: `number`

#### price?

> `optional` **price?**: `number` \| `null`

#### productId?

> `optional` **productId?**: `string` \| `null`

#### productName?

> `optional` **productName?**: `string` \| `null`

#### quantity?

> `optional` **quantity?**: `number` \| `null`

#### zwienczenie?

> `optional` **zwienczenie?**: `string`

***

### notes

> **notes**: `string`

Defined in: [src/services/pdf/types.ts:56](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L56)

***

### offerNumber

> **offerNumber**: `string`

Defined in: [src/services/pdf/types.ts:31](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L31)

***

### orderNumber?

> `optional` **orderNumber?**: `string`

Defined in: [src/services/pdf/types.ts:33](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L33)

***

### orderStatus?

> `optional` **orderStatus?**: `string`

Defined in: [src/services/pdf/types.ts:35](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L35)

***

### paymentTerms?

> `optional` **paymentTerms?**: `string`

Defined in: [src/services/pdf/types.ts:57](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L57)

***

### productionOrderNumber?

> `optional` **productionOrderNumber?**: `string`

Defined in: [src/services/pdf/types.ts:34](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L34)

***

### transportCost

> **transportCost**: `number`

Defined in: [src/services/pdf/types.ts:53](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L53)

***

### validity?

> `optional` **validity?**: `string`

Defined in: [src/services/pdf/types.ts:58](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L58)

***

### validityDays

> **validityDays**: `number`

Defined in: [src/services/pdf/types.ts:55](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/types.ts#L55)
