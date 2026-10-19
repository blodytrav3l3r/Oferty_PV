# Aktywny plan — domknięcie audit P1 (2026-10-19)

Wersja: 1.46.4. Push zablokowany do jawnego GO.

## Zrobione (bez pusha)

| Paczka | Commit    | Zakres                                                                               |
| ------ | --------- | ------------------------------------------------------------------------------------ |
| A      | `0628325` | CI E2E, DATABASE_URL guard, P2003/P2034 mapowanie, notices                           |
| B      | `7a35ca7` | UNIQUE offer_number + migracja, history/updatedAt/audit w PUT rury+studnie           |
| C      | `44578d4` | PDF escape + JS off, `<thead>`, mobile nav, Excel Ctrl+A >1000                       |
| D      | `b65d338` | audit POST w tx (rury+studnie), `spa-guard` w CI z BASE_URL, aria-label kafli        |
| E      | `f36c65d` | wspólny `pricelistLock` (4 moduły), a11y menu kolumn/resize/nagłówka (P1-11)         |
| F      | `4538bf7` | ratchet ADR-004 (`npm run ratchet:check`, baseline 273) + amendment ADR              |
| G      | (ten)     | ekstrakcja read-modelu AI (`src/services/telemetry/aiReadModel.ts`); ratchet 273→267 |

## Decyzja produktowa P1-17 (2026-10-19)

- **Ekran klientów: NIE teraz (YAGNI).** Klienci są zarządzani inline w kreatorze oferty
  (`clientManager.js`), API i katalog kontaktów są dojrzałe; osobny ekran nie ma jeszcze konsumenta.
  Wrócić, gdy pojawi się realny workflow (np. praca bez oferty, import bazy klientów).
- **`productionStatus`: NIE.** Kartoteka Zleceń ma statusy `draft|accepted` mapowane w UI na
  „Oczekujące/Zatwierdzone" — to kolejka akceptacji, nie śledzenie produkcji. Brak w UI obietnicy
  etapów produkcji, więc nie budujemy maszyny stanów bez wymagania biznesowego.

## Świadomie pominięte (z uzasadnieniem)

- **P1-3 FK `offers_rel.pricelistVersionId`** — SQLite wymaga rebuild tabeli hot; stamp i tak jest
  walidowany po stronie serwera (tylko ACTIVE, `ruryCrud.ts:184-191`). ROI niskie, ryzyko migracji
  wysokie → odłożone.
- **TRUST_PROXY** — domyślnie 1, udokumentowane (README/DEPLOYMENT/ADR-006); zmiana defaultu łamie
  Secure-cookie detection za proxy. Konfiguracja deployu, nie kod.
- **P1-17 ekran klientów + `productionStatus`** — decyzja produktowa, wymaga GO użytkownika.

## Następne kandydatury (do wyboru)

1. Ekstrakcja 3 najgorętszych route'ów do `src/services` (ratchet już pilnuje kierunku).
2. Higiena docs: `docs/plans` → `archive/`, liczby legacy w docs vs kod.
3. P2 z audytu (przegląd `catch`/silent-fail, drobne UX).

## Bramy

`npm run validate` (zawiera `ratchet:check`), `npm run format`, `npm run version:check` — wszystkie
zielone po ostatnim commicie (test:quick: 4931 pass / 7 skip).
