# ADR-014: Granica iframe między modułami SPA zostaje

**Status:** Zaakceptowany
**Data:** 2026-10-06
**Autor:** Pakiet spa-guard-pro (domknięcie P2-a)

## Kontekst

Shell `app.html` ładuje 4 moduły w osobnych iframe (`rury/studnie/kartoteka/zlecenia.html`;
rury: 66 tagów `<script>`, studnie: 185, ~1434 globali `window.*` w całym legacy). Iframe daje
izolację JS/CSS/stanu DOM „za darmo". Rozważano wycofanie iframe na rzecz jednego DOM + ESM
(P2-a pakietu spa-guard-pro).

ADR-008 już przesądza bazę: konwersja hurtowa na ESM niemożliwa (klasyczny `<script>` nie
`import`uje z ESM, brak bundlera po ADR-005, cykle importów = błędy runtime). Zdjęcie iframe
bez konwersji skryptów nie wchodzi w grę — duplikaty globali między rury/studnie
(`clearOfferForm`, `showSection` itd.) są świadomą izolacją domenową i w jednym DOM by się
zderzyły.

## Decyzja

Iframe zostaje jako **zaprojektowana granica** (modular monolith), nie dług tymczasowy.
Komunikacja jest same-origin i korzysta z kilku jawnych, istniejących interfejsów. Nie
deklarujemy jednego uniwersalnego protokołu ani nie przenosimy całości na `postMessage`.

### Kontrakty parent–iframe

- `__sok*` z `public/js/shared/sokDirty.js` obsługuje wyłącznie niezapisane zmiany, zapis,
  porzucanie zmian i nawigację do shella: `__sokIsDirty()`, `__sokDescribeDirty()`,
  `__sokSaveDirty(win)`, `__sokCanSave(win)`, `__sokKindLabel(kind)`,
  `__sokDirtyWindow(hint)`, `__sokCountDrafts()`, `__sokAbandonLocal()`,
  `__sokAbandonCurrent()`, `__sokGoLogin()` oraz `__sokNavigateShell(hash)`.
- `window.SpaRouter` z `public/js/spa/router.js` jest interfejsem powłoki: `showSection`,
  `navigate`, `openOfferInModule`, `refreshModule` i `refreshProductionOrders`. Moduły
  wywołują go dla nawigacji i odświeżenia danych.
- Bezpośrednie API domenowe pozostaje lokalne dla istniejącego modułu. Przykłady używane
  przez powłokę to `CennikHost.activate`, `selectCennikTab`, `openRuryVersionsPanel`,
  `openStudnieVersionsPanel`, `pricelistVersions.openFromDeepLink`, a dla odświeżania
  kartoteki/zleceń `AppKartoteka.loadOffers` i `AppZlecenia.loadOrders`. To istniejące
  mostki legacy; ich usunięcie wymaga osobnej migracji i testów.

`public/js/types.d.ts` opisuje publiczne API powłoki i kontrakt `__sok*`. Test kontraktu
sprawdza zgodność deklaracji z nazwami używanymi w kodzie.

- `__sokIsDirty()` — SSoT niezapisanych zmian (flagi + diff draft-vs-SAVED + skan iframe),
- `__sokDescribeDirty()` / `__sokKindLabel()` — kontekst do komunikatów,
- `__sokSaveDirty(win)` — zapis agnostyczny wobec kontraktu saverów,
- `__sokDirtyWindow(hint)` / `__sokCountDrafts()` — namierzanie i liczenie draftów.

## Uzasadnienie

1. **Koszt migracji nieproporcjonalny:** ~250 plików i pełny łańcuch ładowania do przepisania
   za zysk głównie estetyczny (payload, brak quirksów focus/iframe).
2. **Ryzyka granicy pokryte:** guard 3-btn na wszystkich wyjściach (moduł, link, F5, logout,
   A-vs-B), draft jako siatka ostatniej szansy, swornik E2E `tests/playwright/spa-guard.cjs`
   (G0–G9) + vm `tests/frontend/sokDirty.test.ts` + `tests/frontend/navGuard.test.ts`.
3. **Spójność z ADR-002/ADR-008:** Vanilla SPA + klasyczne skrypty; iframe jest ich naturalną
   granicą modułów.

## Konsekwencje

- Nie dodajemy nowych globali przy okazji tej decyzji. Każdy przyszły interfejs
  parent↔iframe musi mieć właściciela, deklarację typów i test kontraktu; API domenowe nie
  powinno być rozszerzane bez potrzeby.
- Kolejność `<script>` (w tym `sokDirty.js` po `ui.js`, przed `router.js`) częścią kontraktu.

## Triggery rewizyty

- Współdzielony stan na żywo między modułami (dziś: brak — tylko guard/draft),
- mierzalny problem focus/performance z winy iframe (z liczbami, nie opinią),
- produktowy rewrite całego modułu (wtedy ESM od zera w nowym module).

## Alternatywy odrzucone

| Alternatywa              | Powód odrzucenia                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| Jeden DOM + ESM          | Rewrite ~250 plików; cykle, brak bundlera (ADR-005, ADR-008)                                           |
| Shadow DOM               | Izoluje CSS, nie JS — kolizje globali zostają                                                          |
| Framework micro-frontend | Sprzeczny z ADR-002 (Vanilla SPA), nowa zależność                                                      |
| Stopniowe wysysanie      | Dwa systemy naraz przez miesiące; spłata tylko przy okazji dotykania plików (dozwolona, nie planowana) |

## Doprecyzowanie wdrożeniowe (2026-11-07)

„Klasyczne skrypty” w tej decyzji opisują dominujący legacy i pozostają powodem,
by nie łączyć modułów ani nie usuwać iframe. Nie wykluczają izolowanych entrypointów
ESM i współdzielonych modułów ESM z mostkiem dla legacy callerów. `__sok*` pozostaje
kontraktem niezapisanych zmian, a powłoka i moduły zachowują opisane wyżej interfejsy.
Zasady przyrostowego współistnienia opisuje ADR-008 oraz `docs/agents/frontend.md`.
