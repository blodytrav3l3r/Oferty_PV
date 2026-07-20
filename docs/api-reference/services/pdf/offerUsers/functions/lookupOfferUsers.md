[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [services/pdf/offerUsers](../README.md) / lookupOfferUsers

# Function: lookupOfferUsers()

> **lookupOfferUsers**(`offerData`, `offerUserId?`): `Promise`\<\{ `authorUser`: [`UserContactInfo`](../../types/interfaces/UserContactInfo.md) \| `null`; `guardianUser`: [`UserContactInfo`](../../types/interfaces/UserContactInfo.md) \| `null`; \}\>

Defined in: [src/services/pdf/offerUsers.ts:6](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pdf/offerUsers.ts#L6)

## Parameters

### offerData

`Record`\<`string`, `unknown`\>

### offerUserId?

`string` \| `null`

## Returns

`Promise`\<\{ `authorUser`: [`UserContactInfo`](../../types/interfaces/UserContactInfo.md) \| `null`; `guardianUser`: [`UserContactInfo`](../../types/interfaces/UserContactInfo.md) \| `null`; \}\>
