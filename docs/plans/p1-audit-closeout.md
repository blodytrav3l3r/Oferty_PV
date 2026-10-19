# Aktywny plan — domknięcie audytu (2026-10-19)

Wersja: 1.46.5. Push zablokowany do jawnego GO.

## Zrobione — P1 (bez pusha)

| Paczka | Commit    | Zakres                                                                               |
| ------ | --------- | ------------------------------------------------------------------------------------ |
| A      | `0628325` | CI E2E, DATABASE_URL guard, P2003/P2034 mapowanie, notices                           |
| B      | `7a35ca7` | UNIQUE offer_number + migracja, history/updatedAt/audit w PUT rury+studnie           |
| C      | `44578d4` | PDF escape + JS off, `<thead>`, mobile nav, Excel Ctrl+A >1000                       |
| D      | `b65d338` | audit POST w tx (rury+studnie), `spa-guard` w CI z BASE_URL, aria-label kafli        |
| E      | `f36c65d` | wspólny `pricelistLock` (4 moduły), a11y menu kolumn/resize/nagłówka (P1-11)         |
| F      | `4538bf7` | ratchet ADR-004 (`npm run ratchet:check`) + amendment ADR                            |
| G      | `a91723a` | ekstrakcja read-modelu AI (`src/services/telemetry/aiReadModel.ts`); ratchet 273→267 |
| H      | `a56c8a4` | serwis cennika (`src/services/precoPricing.ts`); ratchet 267→239                     |
| I      | `46bd60d` | liczniki wydruków (`src/services/orders/productionPrintCounts.ts`); ratchet 239→237  |

## Zrobione — P2/P3 (paczki J, K, M, N)

| Paczka | Commit    | Zakres                                                                                           |
| ------ | --------- | ------------------------------------------------------------------------------------------------ |
| J      | `76d53f3` | `PUBLIC_BASE_URL` + walidacja Host (open-redirect), `sanitizeForLog` (log forging), limitery     |
| K      | `b86aad7` | bramka flaky (`--max-flaky`), `BASE_URL` w harnessach, `test:excel-visual`                       |
| M      | `982688b` | SSoT `computeUnitPriceNetto` (PDF, NaN→0), 4× silent catch → log, nota API dla `GET /production` |
| N      | `aa22808` | liczby legacy w AGENTS.md (`.onclick` 37→21), amendment ADR-004 (273→237), nota długu FK         |
| O      | (ten)     | a11y P3: `aria-pressed` PEHD, `aria-label` pól oferty, `<title>/<desc>` logo, `aria-hidden` ★    |

## Decyzja produktowa P1-17 (2026-10-19)

- **Ekran klientów: NIE teraz (YAGNI).** Klienci zarządzani inline w kreatorze oferty
  (`clientManager.js`); osobny ekran nie ma konsumenta. Wrócić przy realnym workflow.
- **`productionStatus`: NIE.** Kartoteka Zleceń ma `draft|accepted` = kolejka akceptacji,
  nie śledzenie produkcji; brak obietnicy etapów w UI.

## Świadomie pominięte (z uzasadnieniem)

- **P1-3 FK `offers_rel.pricelistVersionId`** — SQLite wymaga redefinicji tabel; baza ~1.5 GB
    - 30 backupów, a freeze jest walidowany aplikacyjnie (`ruryCrud.ts`, `studnieCrud.ts`) i
      chroniony w `lifecycle.ts`. Nota długu: `docs/adr/ADR-001-sqlite.md` → „Znane długi".
      Kontrola sierot: `scripts/audit-integrity.mjs`.
- **TRUST_PROXY** — zostaje 1 (TLS terminuje Caddy, Node bind 127.0.0.1); dodana walidacja
  wartości + WARN (`src/app.ts`). Bez wymuszania env — łamałoby Docker/świeże instalacje.
- **PII `/api/users/for-assignment`** — zostaje: stopka wydruku renderuje email/telefon
  (`offerPrintManager.js`); endpoint za `requireAuth` + `apiLimiter`, narzędzie wewnętrzne.
- **`GET /api/orders-studnie/production` bez `data`** — brak konsumentów w repo, ale kontrakt
  publiczny: nie zmieniamy odpowiedzi w ciemno; nota deprecacyjna w `docs/API.md`
  (rekomendacja: `/index` i `/search`).
- **Frontend price math SSoT** (`unitPrice * (1 - discount/100)` w 8 miejscach legacy) —
  osobna paczka; SSoT backendowy (wydruk, ścieżka pieniężna) już jest.
- **Inline styles w empty states** (`kartotekaSearch.js`, `orderPrzejscia.js`) — wymaga nowych
  klas CSS i _weryfikacji wizualnej w przeglądarce_, której audyt nie miał; refaktor w ciemno
  to ryzyko regresji layoutu bez dowodu → odłożone do paczki z runtime (Playwright).
- **`★` w tekstach** (`clientManager.js` lista/opcje, `carePanel.js` pill) — gwiazdka jest częścią
  tekstu (`contentText`), nie da się jej zamienić na ikonę Lucide bez zmiany struktury DOM;
  dodano `aria-hidden` tam, gdzie gwiazdka jest osobnym elementem obok etykiety.
- **Excel `localStorage` swallow** (`excelState.js`, 7×) — celowy best-effort cache szerokości
  kolumn (brak zapisu = brak problemu); Excel to protected zone, log nie wnosi wartości.
- **Kolizje globals 45 = 45 bez zapasu** — celowe: ratchet ma blokować nowe globalne.

## Następne kandydatury

1. Ekstrakcja kolejnych route'ów do `src/services` (ratchet pilnuje kierunku: 237).
2. Frontend: wspólny helper ceny + redukcja `window.*` w `public/js` (legacy, ostrożnie).
3. Runtime a11y/diff bramka Playwright (kontrast, 375/768/1440) — odblokowuje inline styles.

## Bramy

`npm run validate` (zawiera `ratchet:check`), `npm run format`, `npm run version:check` — zielone;
`test:quick`: 4946 pass / 7 skip (po paczce O).
