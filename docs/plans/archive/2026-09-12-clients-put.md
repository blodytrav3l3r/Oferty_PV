# P0 clients PUT — read-only plan (bez implementacji)

**Status:** CLOSED (`80b10ec`). Pusta tablica od nie-admina → 403, `userId` tylko dla nowych wierszy, testy 32/32. Stale-replace: jawny residual. UI/schemat nietknięte.
**Luka:** `PUT /api/clients/` (`clients.ts:53`) — każdy zalogowany: full-replace + sync-delete + przepisanie `userId` na siebie; `{data: []}` czyści tabelę. Poza modelem „wspólna edycja".

## 1. Kontrakt frontendu (niezmienny w tym planie)

- Jedyny konsument: `clientManager.js` (`loadClientsDb` GET, `saveClientsDbData` PUT całej `clientsDb`).
- Operacje UI: dodaj (push + PUT), edytuj (merge + PUT), usuń 1 (filter + PUT) — ZAWSZE full-replace całej lokalnej tablicy.
- Dodatkowy wektor (nie-auth): **stale `clientsDb`** — sesja wczytana rano + zapis wieczorem kasuje cudze dzienne wpisy przez `toDelete`. Samo zaostrzenie auth tego nie naprawi.

## 2. Invariant docelowy

> Współdzielona edycja klientów ≠ destrukcyjny full-replace ani zmiana własności.
> Zwykły handlowiec: dodawanie/edycja/usuwanie pojedynczych wpisów — tak; czyszczenie tabeli i przepisywanie `userId` — nie.

## 3. Proponowana zmiana (tylko backend, kontrakt bez zmian)

1. **Pusta tablica:** `{data: []}` (lub brak `data`) od nie-admina → 403. Admin bez zmian. Blokuje one-shot wipe bez dotykania żadnego flow UI (żaden nie czyści całości legalnie).
2. **Własność:** przy update ISTNIEJĄCEGO wiersza ignoruj `userId` z payloadu (zostaw właściciela z DB); `userId` edytującego ustawiaj TYLKO dla nowych wierszy. Blokuje masowe przepisywanie własności; UI nic nie zmienia (i tak nie pokazuje właścicieli).
3. Bez zmian: kształt odpowiedzi, GET, walidacja zod, transakcja, admin.

## 4. Świadome residual (poza zakresem)

- Usuwanie pojedynczych cudzych wpisów przez nie-admina zostaje (model współdzielony; kasacja całości zablokowana w pkt 1).
- Stale-replace (klient A nadpisuje wpisy klienta B ze starej sesji) — łagodzi pkt 2 (własność) + test, pełne rozwiązanie (etag/version na `clientsDb`) to osobny temat.
- `userId` w GET bez zmian.

## 5. Testy (przyszłe)

- `{data: []}` od user → 403, od admin → 200 (mock).
- Update istniejącego nie zmienia `userId` (mock: asercja SQL/args, nie `userId` edytującego); create ustawia `userId` edytującego.
- Istniejące `apiValidation` PUT (389-432) + `clientsIdor` (66-117) dostosować do nowego kontraktu.
- Real-DB: brak sierot/wycieku przy 403 (wzorzec `ruryDuplicateAtomic`).

## 6. Weryfikacja (przyszła)

`typecheck` + `lint` + `node -c` (brak zmian frontend) + testy + `format`. Bez zmian wersji. Bez commita automatycznego.
