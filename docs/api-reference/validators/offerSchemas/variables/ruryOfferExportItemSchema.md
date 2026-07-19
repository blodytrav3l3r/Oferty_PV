[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/offerSchemas](../README.md) / ruryOfferExportItemSchema

# Variable: ruryOfferExportItemSchema

> `const` **ruryOfferExportItemSchema**: `ZodObject`\<\{ `autoAdded`: `ZodPreprocess`\<`ZodOptional`\<`ZodBoolean`>>\>\>; `category`: `ZodPreprocess`\<`ZodOptional`\<`ZodString`>>\>\>; `discount`: `ZodPreprocess`\<`ZodOptional`\<`ZodNumber`>>\>\>; `name`: `ZodString`; `pehdCostPerUnit`: `ZodPreprocess`\<`ZodOptional`\<`ZodNumber`>>\>\>; `pehdType`: `ZodPreprocess`\<`ZodOptional`\<`ZodEnum`\<\{\[`key`: `string`\]: `string`; \}\>\>\>; `productId`: `ZodString`; `quantity`: `ZodPreprocess`\<`ZodNumber`>\>; `uid`: `ZodPreprocess`\<`ZodOptional`\<`ZodString`>>\>\>; `unitPrice`: `ZodPreprocess`\<`ZodNumber`>\>; `weight`: `ZodPreprocess`\<`ZodOptional`\<`ZodNumber`>>\>\>; \}, `$strip`>\>

Defined in: [src/validators/offerSchemas.ts:514](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/validators/offerSchemas.ts#L514)

Schemat pozycji oferty wysyłanej do eksportu PDF/DOCX
z bieżącego stanu edycji zamówienia (krok 5).

Pola wymagane: productId, name, unitPrice, quantity.
Pola opcjonalne akceptują null/'' jako "brak wartości"
(dzięki helperom nullish*). Generator PDF/DOCX ma fallbacki
dla brakujących danych (np. category='Inne', weight=0).
