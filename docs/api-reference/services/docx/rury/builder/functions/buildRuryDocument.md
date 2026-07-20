[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../../README.md) / [services/docx/rury/builder](../README.md) / buildRuryDocument

# Function: buildRuryDocument()

> **buildRuryDocument**(`offer`, `offerData`, `client`, `items`, `authorUser`, `guardianUser`, `documentType?`): `File_2`

Defined in: [src/services/docx/rury/builder.ts:17](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/docx/rury/builder.ts#L17)

## Parameters

### offer

`Record`\<`string`, `unknown`\>

### offerData

`Record`\<`string`, `unknown`\>

### client

`Record`\<`string`, `unknown`\> \| `null`

### items

`Record`\<`string`, `unknown`\>[]

### authorUser

[`UserContactInfo`](../../../../pdf/types/interfaces/UserContactInfo.md) \| `null`

### guardianUser

[`UserContactInfo`](../../../../pdf/types/interfaces/UserContactInfo.md) \| `null`

### documentType?

`"offer"` \| `"order"`

## Returns

`File_2`
