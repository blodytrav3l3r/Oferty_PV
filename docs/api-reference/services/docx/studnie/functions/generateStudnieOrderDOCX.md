[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [services/docx/studnie](../README.md) / generateStudnieOrderDOCX

# Function: generateStudnieOrderDOCX()

> **generateStudnieOrderDOCX**(`orderId`): `Promise`\<`Buffer`\<`ArrayBufferLike`>>\>\>

Defined in: [src/services/docx/studnie/index.ts:104](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/docx/studnie/index.ts#L104)

Generuje dokument DOCX dla ZAMÓWIENIA studni (wariant oferty).
Buduje kontekst z orders_studnie_rel (z fallbackiem na offers_studnie_rel
dla kalkulacji cen) i renderuje przez buildStudnieDocument z documentType='order'.

## Parameters

### orderId

`string`

## Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>
