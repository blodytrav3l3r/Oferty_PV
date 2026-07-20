[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [services/docx/rury](../README.md) / generateOfferRuryDOCX

# Function: generateOfferRuryDOCX()

> **generateOfferRuryDOCX**(`offerId`): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Defined in: [src/services/docx/rury/index.ts:22](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/docx/rury/index.ts#L22)

Generuje dokument DOCX dla oferty rur.

Pobiera ofertę rur z bazy, parsuje dane JSON z offers_rel.data,
przygotowuje dane klienta oraz informacje o autorze i opiekunie handlowym,
następnie buduje kompletny dokument Word z tabelami pozycji i podsumowaniem.

## Parameters

### offerId

`string`

ID oferty rur w bazie danych

## Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Buffer zawierający wygenerowany dokument DOCX

## Throws

Error gdy oferta nie zostanie znaleziona
