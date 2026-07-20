[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [services/docx/rury](../README.md) / generateRuryDOCXFromContext

# Function: generateRuryDOCXFromContext()

> **generateRuryDOCXFromContext**(`ctx`): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Defined in: [src/services/docx/rury/index.ts:60](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/docx/rury/index.ts#L60)

Generuje dokument DOCX dla zamówienia rur w trybie "oferty bieżącej".
Używa tego samego szablonu co generateOfferRuryDOCX, ale z danymi przesłanymi
przez klienta (aktualny stan edycji z orderCurrentItems).

## Parameters

### ctx

Kontekst oferty (items + metadane) zbudowany z bieżącego stanu zamówienia

#### authorUser

[`UserContactInfo`](../../../pdf/types/interfaces/UserContactInfo.md) \| `null`

#### documentType?

`"offer"` \| `"order"`

#### guardianUser

[`UserContactInfo`](../../../pdf/types/interfaces/UserContactInfo.md) \| `null`

#### items

`Record`\<`string`, `unknown`\>[]

#### offerData

`Record`\<`string`, `unknown`\>

#### offerNumber

`string`

## Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Buffer zawierający wygenerowany dokument DOCX
