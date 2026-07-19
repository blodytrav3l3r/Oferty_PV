[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [services/docx/studnie](../README.md) / generateOfferStudnieDOCX

# Function: generateOfferStudnieDOCX()

> **generateOfferStudnieDOCX**(`offerId`): `Promise`\<`Buffer`\<`ArrayBufferLike`>>\>\>

Defined in: [src/services/docx/studnie/index.ts:37](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/docx/studnie/index.ts#L37)

Generuje dokument DOCX dla oferty studni.

Pobiera ofertę studni z bazy, parsuje dane JSON zawierające studnie (wellsExport),
przygotowuje dane klienta oraz informacje o autorze i opiekunie handlowym,
następnie buduje kompletny dokument Word z tabelami studni i podsumowaniem.

## Parameters

### offerId

`string`

ID oferty studni w bazie danych

## Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Buffer zawierający wygenerowany dokument DOCX

## Throws

Error gdy oferta nie zostanie znaleziona

## Example

```ts
const docxBuffer = await generateOfferStudnieDOCX('studnie-456');
res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
);
res.setHeader('Content-Disposition', 'attachment; filename="oferta.docx"');
res.send(docxBuffer);
```
