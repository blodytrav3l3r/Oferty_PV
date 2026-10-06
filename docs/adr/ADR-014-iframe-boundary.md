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
Cały ruch parent↔iframe wyłącznie przez kontrakt `__sok*` w `public/js/shared/sokDirty.js`:

- `__sokIsDirty()` — SSoT niezapisanych zmian (flagi + diff draft-vs-SAVED + skan iframe),
- `__sokDescribeDirty()` / `__sokKindLabel()` — kontekst do komunikatów,
- `__sokSaveDirty(win)` — zapis agnostyczny wobec kontraktu saverów,
- `__sokDirtyWindow(hint)` / `__sokCountDrafts()` — namierzanie i liczenie draftów.

## Uzasadnienie

1. **Koszt migracji nieproporcjonalny:** ~250 plików i pełny łańcuch ładowania do przepisania
   za zysk głównie estetyczny (payload, brak quirksów focus/iframe).
2. **Ryzyka granicy pokryte:** guard 3-btn na wszystkich wyjściach (moduł, link, F5, logout,
   A-vs-B), draft jako siatka ostatniej szansy, swornik E2E `tests/playwright/spa-guard.cjs`
   (G0–G9) + vm `tests/frontend/sokDirty.test.ts` + `tests/spa/navGuard.test.ts`.
3. **Spójność z ADR-002/ADR-008:** Vanilla SPA + klasyczne skrypty; iframe jest ich naturalną
   granicą modułów.

## Konsekwencje

- Nowe globale `window.*` tylko przez kontrakt (strażnik: `collisions:check`, baseline 45).
- Nowy dostęp parent↔iframe = dopisanie do kontraktu + test (vm lub E2E), nigdy surowy
  `contentWindow.saveX` w kodzie produktu.
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
