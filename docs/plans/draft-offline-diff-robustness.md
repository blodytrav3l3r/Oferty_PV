# Draft: odporność na rozłączenie + prawdziwe diffy (plan)

Plan v1.0 — klepnięty po review (9,5/10).
**Status:** do implementacji, etapami B → A, osobne commity.

## Decyzje (po review)

1. **B2:** `items` order-insensitive, `wells` order-sensitive. Kolejność studni może
   nieść znaczenie (numeracja/nazwy W1/W2) — nie normalizować bez dowodu w kodzie.
   Zasada: normalizuj kolejność tylko tam, gdzie nie jest częścią semantyki danych.
2. **Kolejność:** najpierw B (semantyka porównania + testy), potem A (UX offline).
3. **Osobny commit** dla B i osobny dla A.

## Etap 1 — B: prawdziwe diffy

Wszystkie normalizacje **wyłącznie w `_draftComparablePayload`**
(`public/js/shared/draftAutosave.js:448`). Payload draftu (zapis/recovery)
nietknięty:

```text
draftPayload
   │
   ├── zapis / recovery → BEZ ZMIAN
   │
   └── comparable → normalizacja
                       ├── B1 liczby (jawna lista pól)
                       ├── B2 items insensitive / wells sensitive
                       └── B3 brak pola → canonical default
```

- **B1 — liczby, jawna lista pól** (nie rekurencyjnie po wszystkim):
  `quantity`, `transportKm`, `transportRate` (+ ewentualne pola, dla których kod
  dopuszcza `number ↔ numeric string`). Ryzyko: identyfikator `"00123"` vs `123`
  to semantycznie różne wartości — stąd allowlista, nie blanket `Number()`.
- **B2 — items insensitive, wells sensitive** (sort kopii po stabilnym kluczu
  `uid → productId`; wells bez zmian kolejności).
- **B3 — brak pola → default w comparable:** brak `wellDiscounts` → `{}`,
  brak `visiblePrzejsciaTypes` → `[]`. Eliminuje szum `Rabaty: zmienione`.
- **Twardy kontrakt (test):** `equivalent === true → describeDiff === []`.
  Przypadki: `quantity 5 === "5"`, `items A/B === B/A`,
  `brak {} === brak pola`, efemeryczne stripowane nie lądują w diffie.

## Etap 2 — A: odporność UX na offline

Bez budowania kolejki offline / auto-retry / service workera (YAGNI —
draft + jawny retry już jest kolejką).

- **A1 — klasyfikacja błędów**, helper w `shared/` (nie per-call-site):
  `navigator.onLine === false` → `offline`; `AbortError`/timeout → `network/timeout`;
  `fetch TypeError` → `network` (nie mylić z offline); `409` → `conflict`;
  `423`/locked → `locked`; inne HTTP → `server`.
  UX łączy `offline + network + timeout` w jeden komunikat:
  „Brak połączenia — zmiany zachowane w drafcie, spróbuj ponownie."
  (lepsza diagnostyka w logach, prosty komunikat dla użytkownika).
  Wpiąć w `offerSave` / `orderCrud` / zapisy rur.
- **A2 — timeout w `StorageService.saveOffer`** (dziś goły `fetch`, wisi przy
  half-open connection) → `fetchWithTimeout` jak reszta modułu.
  Łańcuch: timeout → `saveErrorKind` → komunikat offline → draft pozostaje.
- **A3 — jednorazowy toast offline:** tylko na przejściu `online → offline`
  (flaga stanu, kolejny dopiero po `offline → online → offline`).
  Kropka połączenia (`auth.js`) pozostaje źródłem bieżącego stanu.
  Bez nowych wskaźników UI.

## Co już działa (nie ruszać)

- `clearContext` tylko po sukcesie SAVED; flush `pagehide`/`beforeunload`;
  konflikt 409 (serwer wygrywa, draft nietknięty); blokada 423 (formularz nietknięty);
  strip efemerycznych; DTO zamówień; fallbacki nagłówka; drop `date`/`number`;
  guard SAVED-slim; guard live-at-entry; self-heal ghosta.

## Testy

- B: regresja per normalizacja + kontrakt `equivalent → []`
  (rozszerzyć `tests/frontend/draftDescribeDiff.test.ts`).
- A: klasyfikator błędów (unit) + toast offline single-fire.
- E2E `draftRecovery.cjs` bez zmian semantyki (items reorder nie triggeruje).

## Walidacja (po każdym etapie)

`node -c` → `lint:frontend` → `typecheck:frontend` → jest draft
→ `format`. Commit osobno: B (`fix(studnie): ...`), potem A.
