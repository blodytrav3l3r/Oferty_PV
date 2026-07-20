[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [services/docx/rury](../README.md) / generateRuryOrderDOCX

# Function: generateRuryOrderDOCX()

> **generateRuryOrderDOCX**(`orderId`): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Defined in: [src/services/docx/rury/index.ts:91](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/docx/rury/index.ts#L91)

Generuje dokument DOCX dla ZAMÓWIENIA rur (wariant oferty).
Buduje kontekst z orders_rury_rel (z fallbackiem na offers_rel dla items)
i renderuje przez buildRuryDocument z documentType='order'.

## Parameters

### orderId

`string`

## Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>
