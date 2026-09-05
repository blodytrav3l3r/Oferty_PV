# ADR-010: Transport zamówień studni — DTO allowlist, slim snapshot, single-save

Data: 2026-09-05
Status: zaakceptowana
Powiązane: archiwum planu `docs/plans/archive/2026-09-05-duze-zamowienia-dto-snapshot-plan.md`, baza błędów #15, `public/js/studnie/orderDto.js`

## Kontekst

Zapis zamówienia z ~3000 studni kończył się `HTTP 413`: payload sięgał ~41 MB
(`wells` + pełna kopia `originalSnapshot.wells` + `wellsExport`, wszystko z polami
runtime/cache), a batch-PUT wysyłał dodatkowo WSZYSTKIE zamówienia naraz
(5×3000 studni = ~49 MB). Limit Express 50 MB jest wyłącznie safety cap, nie mechanizmem.

Zasada: `DOM/runtime ≠ dane transportowe ≠ snapshot ≠ dane historyczne`.

## Decyzja

1. **DTO allowlist** (`toWellOrderDTO`, `toWellConfigItemDTO`, `toWellPrzejscieDTO`):
   jedyny kontrakt transportowy. Nowe pola runtime/cache nie wyciekają do API
   automatycznie. Lista pól zweryfikowana audytem konsumentów (kalkulacja, PZ,
   eksport, edycja) — m.in. `klasaNosnosci_*`, `_elemId`, `frozenPrice*`.
2. **`stripWellRuntimeFields` — KEEP jako defense-in-depth** (decyzja świadoma,
   nie zaległość). DTO jest granicą kontraktu; usunięcie odłożone jako cleanup.
3. **Slim snapshot** `{slimWells: [{id, name, price, weight, configHash}]}` zamiast
   pełnej kopii `wells`. Konsumenci (`getOrderChanges`, `offerSummaryTable`) czytają
   gotowe ceny — znika `calcWellStats` na kopii. Legacy (`Array | {wells}`) nadal
   odczytywane (back-compat, bez migracji danych).
4. **Single-order save**: create przez batch-PUT z 1 elementem, update przez
   `PATCH /:id`. Po DELETE brak re-save całości. Batch-PUT zostaje (back-compat).
5. **Optimistic concurrency**: `baseUpdatedAt` → rozjazd = `409 + serverOrder`
   (klient scala kopię serwerową, toast, brak cichego nadpisania). Batch
   wieloelementowy ignoruje `baseUpdatedAt` (semantyka niejednoznaczna).

## Ograniczenie semantyczne `configHash` (caveat)

`configHash` (FNV-1a ze stabilnej serializacji kanonicznego wejścia cenowego:
sortowane klucze + sortowane pozycje) reprezentuje **konfigurację i parametry
zapisane w zamówieniu** — NIE aktualny cennik katalogowy dla pozycji, których
cena nie została zamrożona (`frozenPrice`). Zmiana katalogu może nie zmienić
`configHash`. Nie interpretować hasha jako „hash całego źródła ceny".
Cena ofertowa jest materializowana w `price` obok hasha; rabaty globalne żyją
osobno w `wellDiscounts`.

## Odrzucone alternatywy / odłożone

- Podnoszenie limitu Express ponad 50 MB — przesuwa problem, nie rozwiązuje.
- Chunking (`POST /:id/wells`) i server-side snapshot — **DEFERRED**; wyzwalacz:
  ~8–10k wells/order, payload → 50 MB, `JSON.stringify` → setki ms.
- Zod `.strict()` — osobny hardening task po audycie logów observe (P0.3).

## Konsekwencje

- Nowe pola runtime w UI nie wymagają zmian transportu (allowlist).
- Wyniki: DTO −65,5% (41,32 → 14,27 MB), snapshot −98,2% (13,77 MB → 247 KB),
  payload 9,76 MB; batch 5 zamówień 48,78 MB → single 9,76 MB (3k studni).
- Testy: `orderDto.test.ts`, `orderDtoObserve.test.ts`, `orderDtoSlim.test.ts`,
  `orderSingleSave.test.ts`, `orders/studnieSingleSave.test.ts`.

## Weryfikacja

- `npm run typecheck`, `typecheck:frontend`, `test:quick:lite` (170 suitów),
  `format`, `version:check`, `scripts/benchmark-order-dto.cjs`.
