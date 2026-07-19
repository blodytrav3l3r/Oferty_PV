[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/offerSchemas](../README.md) / studnieOfferExportItemSchema

# Variable: studnieOfferExportItemSchema

> `const` **studnieOfferExportItemSchema**: `ZodObject`\<\{ `discount`: `ZodPreprocess`\<`ZodOptional`\<`ZodNumber`>>\>\>; `DN`: `ZodPreprocess`\<`ZodOptional`\<`ZodString`>>\>\>; `dodatkowe_info`: `ZodPreprocess`\<`ZodOptional`\<`ZodString`>>\>\>; `height`: `ZodPreprocess`\<`ZodOptional`\<`ZodNumber`>>\>\>; `price`: `ZodPreprocess`\<`ZodNumber`>\>; `productId`: `ZodPreprocess`\<`ZodOptional`\<`ZodString`>>\>\>; `productName`: `ZodString`; `quantity`: `ZodPreprocess`\<`ZodNumber`>\>; `transportCost`: `ZodPreprocess`\<`ZodOptional`\<`ZodNumber`>>\>\>; `zwienczenie`: `ZodPreprocess`\<`ZodOptional`\<`ZodString`>>\>\>; \}, `$strip`>\>

Defined in: [src/validators/offerSchemas.ts:573](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/validators/offerSchemas.ts#L573)

Schemat pozycji studni wysyłanej do eksportu PDF/DOCX
z bieżącego stanu edycji zamówienia (krok 5).

Pola opcjonalne akceptują null/'' jako "brak wartości"
(dzięki helperom nullish*). Generator PDF/DOCX ma fallbacki
dla brakujących danych (np. zwienczenie='—', height=0).
