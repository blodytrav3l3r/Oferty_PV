[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [services/docx/studnie](../README.md) / generateStudnieDOCXFromContext

# Function: generateStudnieDOCXFromContext()

> **generateStudnieDOCXFromContext**(`ctx`): `Promise`\<`Buffer`\<`ArrayBufferLike`>>\>\>

Defined in: [src/services/docx/studnie/index.ts:73](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/docx/studnie/index.ts#L73)

Generuje dokument DOCX dla zamówienia studni w trybie "oferty bieżącej".
Używa tego samego szablonu co generateOfferStudnieDOCX, ale z danymi przesłanymi
przez klienta (aktualny stan edycji zamówienia z kroku 5).

## Parameters

### ctx

Kontekst oferty (offerData + wells + metadane) zbudowany z bieżącego stanu zamówienia

#### authorUser

[`UserContactInfo`](../../../pdf/types/interfaces/UserContactInfo.md) \| `null`

#### documentType?

`"offer"` \| `"order"`

#### guardianUser

[`UserContactInfo`](../../../pdf/types/interfaces/UserContactInfo.md) \| `null`

#### offerData

`Record`\<`string`, `unknown`\>

#### offerNumber

`string`

#### wells

`Record`\<`string`, `unknown`\>[]

## Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Buffer zawierający wygenerowany dokument DOCX
