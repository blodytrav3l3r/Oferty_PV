[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../../README.md) / [services/docx/studnie/builder](../README.md) / buildStudnieDocument

# Function: buildStudnieDocument()

> **buildStudnieDocument**(`offer`, `offerData`, `client`, `wells`, `authorUser`, `guardianUser`, `documentType?`): `File_2`

Defined in: [src/services/docx/studnie/builder.ts:30](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/docx/studnie/builder.ts#L30)

Buduje kompletny obiekt Document oferty studni na podstawie sparsowanych danych

## Parameters

### offer

`Record`\<`string`, `unknown`\>

### offerData

`Record`\<`string`, `unknown`\>

### client

`Record`\<`string`, `unknown`\> \| `null`

### wells

`unknown`[]

### authorUser

[`UserContactInfo`](../../../../pdf/types/interfaces/UserContactInfo.md) \| `null`

### guardianUser

[`UserContactInfo`](../../../../pdf/types/interfaces/UserContactInfo.md) \| `null`

### documentType?

`"offer"` \| `"order"`

'offer' (domyślnie) — klasyczna oferta z terminem ważności;
'order' — zamówienie (wariant oferty) — bez terminu ważności,
tytuł zmieniony na "ZAMÓWIENIE {numer}", numer z orderNumber.

## Returns

`File_2`
