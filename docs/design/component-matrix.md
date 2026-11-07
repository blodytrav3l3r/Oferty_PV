# Component matrix — S.O.K.

**Aktualizacja:** 2026-11-07
**Źródło reguł:** [`docs/UI_GUIDELINES.md`](../UI_GUIDELINES.md)
**Zakres:** mapa istniejących wzorców do ponownego użycia; nie jest listą wszystkich
historycznych naruszeń ani zgodą na masowy refaktor.

## Wspólne wzorce

| Obszar             | Wspólne rozwiązania                                                                                                                                           | Granice i uwagi                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Przyciski          | `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-success`, `.btn-warn`, `.btn-ghost`, `.btn-sm`, `.btn-icon` w `style.base.css` i `style.utilities.css` | Warianty modułowe mogą zachować własną geometrię, gdy jest częścią istniejącego przepływu.                                    |
| Formularze         | `.form-group`, `.form-label`, `.form-input`, `.form-select`, `.form-textarea`, `.form-row-*`, `.edit-input`                                                   | Zachowuj scoped warianty; pilnuj widocznego fokusu, etykiet i osiągalności pól na małym ekranie.                              |
| Tabele             | `.table-wrap`, wspólne tokeny, sticky headers tam, gdzie moduł ich używa                                                                                      | Tabele Rur, Zleceń i Excela mają odrębne kontrakty i model renderowania; nie ujednolicać geometrii bez weryfikacji przepływu. |
| Modale             | `shared/modalCore.js`, `.modal-overlay`, `.modal`, `.modal-header`, `.modal-footer`, `.modal--sm/md/lg`                                                       | Istniejące wyspecjalizowane modale migrować tylko przy zmianie ich zachowania lub wyglądu.                                    |
| Tokeny             | `public/css/style.base.css` — kolory, rozmiary, typografia, radius, cienie i warstwy                                                                          | Gołe hexy poza tokenami wymagają uzasadnienia; wyjątki muszą być świadome i lokalne.                                          |
| Ikony i dostępność | Lucide (`data-lucide`), `:focus-visible`, nazwy dostępne dla ikonowych przycisków                                                                             | Kolor nie może być jedynym sygnałem stanu; respektuj `prefers-reduced-motion`.                                                |
| Karty i nawigacja  | `.card*`, `.nav-tile--*`, `.catalog-tabs`, `.status-*` i istniejące komponenty modułów                                                                        | Nowe wzorce wspólne dodawać do wspólnego CSS, nie kopiować selektorów do modułów.                                             |

## Zasady architektoniczne frontendu

- Vanilla JS i istniejące iframe pozostają granicami modułów (ADR-002, ADR-014).
- Nie konwertować masowo skryptów legacy. Nowe wydzielone entrypointy mogą być ESM;
  współistnienie z klasycznymi callerami i istniejące mostki globali opisuje ADR-008.
- Nie dodawać nowych globali `window.*`, handlerów `onclick` ani inline styles.
- Excel Studni jest strefą chronioną: małe, celowane zmiany; brak niezwiązanego cleanupu.
- Excel dobiera barwy przez CSS tokens. Testy pilnują braku odczytu motywu w rendererze
  i par tokenów jasnego/ciemnego motywu.
- Kreator Rur i Studni: ostatnie pole aktywnego kroku pozostaje osiągalne nad dolną
  nawigacją przy szerokości 390 px; regresję sprawdza Playwright.

## Ograniczenia i nieweryfikowane obszary

Historyczne liczniki inline-style/hex obejmują również style generowane dynamicznie,
wyjątki i legacy. Same dopasowania tekstowe nie dowodzą naruszenia konkretnego
ekranu, dlatego nie są tu przedstawiane jako potwierdzone błędy. Nie wykonywano
masowej migracji selektorów, modalów, tabel ani kolorów. Zmiany w tych obszarach
wymagają analizy wykorzystania, porównania przed/po i testu właściwego modułu.
