# Cenniki — panel sterowania adminem (plan wdrożenia)

**Data:** 2026-10-21
**Status:** plan gotowy do realizacji (realizacja czeka na polecenie)
**Powiązany plan:** `docs/plans/2026-10-20-cenniki-centrum-p0.md` (S0–S6 centrum wersji — kod S0–S3 i S5 gotowe; S2a deploy otwarty)
**SSoT instrukcja dla admina:** `docs/CENNIKI-INSTRUKCJA-ADMINA.md` (do przepisania w M0)
**Mockup UI:** `C:\Users\blody\.opencode\plan\cenniki-panel-mockup.html` (3 widoki: Przegląd / Cennik / Historia)

---

## 1. Cel

Jeden moduł SPA (`#/cenniki`), **tylko dla administratora**, w którym admin widzi i prowadzi cały system
cenników z jednego miejsca:

- trzy niezależne osie cenników: **Rury**, **Studnie**, **PRECO**;
- sekcje treści studni 1:1 z istniejącym edytorem (DN1000…Kinety, Transport) + osobna oś **Wkładki PRECO**;
- jawne statusy: **Obowiązuje / Do wdrożenia / W przygotowaniu / Historyczny**;
- podgląd i edycja cennika, kontrola przed publikacją, oś czasu wersji i historia w jednym miejscu.

Nie powstaje drugi dashboard ani duplikat edytora siatki — panel dookoła istniejących edytorów.

## 2. Stan obecny (fakt — kod)

### 2.1 Model danych

- `prisma/schema.prisma:975-1002` — `PricelistVersion` (status zapisany, `effectiveFrom` jako oś czasu),
  `PricelistItem*` jako zamrożony snapshot pozycji (FK `Restrict`).
- Statusy zapisane: **`DRAFT` | `APPROVED`** (`src/services/pricelist/validation.ts:32`).
- Stany wyliczane: **`SCHEDULED` | `ACTIVE` | `ARCHIVED`** (`validation.ts:43-61` `deriveState`).
- Guardy: `EDITABLE_STATUSES=['DRAFT']`, `IMMUTABLE_STATUSES=['APPROVED']`, `RESOLVABLE_STATUSES=['APPROVED']`,
  `PRECO_REFERENCE_STATUSES=['APPROVED']` (`validation.ts:64-76`).
- Resolver: `resolveActive` = najnowsza `APPROVED` z `effectiveFrom <= now` (`usage.ts:164-178`).
- Zapis domyślnie do szkicu: `PRICELIST_WRITE_TARGET=draft` (`writeTarget.ts:14-16`), edytor czyta
  `DRAFT → ACTIVE → LIVE` (`writeTarget.ts:40-45`, `src/routes/productsV2.ts:41-78`).
- Oferty czytają wersję obowiązującą: `?source=active` (`public/js/app.js:139`, `public/js/appStudnie.js:191`).

### 2.2 Istniejące UI

| Element                        | Plik                                                 | Stan                                                                                                    |
| ------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Kafelek SPA „Cenniki”          | `public/app.html:156-164`                            | istnieje, **widoczny dla wszystkich** (brak gatingu admina)                                             |
| Moduł SPA `cenniki`            | `public/js/spa/router.js:294-310`                    | `cenniki.html`, 3 sekcje: Przegląd / Cennik / Historia                                                  |
| Hub (Przegląd/Cennik/Historia) | `public/cenniki.html`, `public/js/cennikiHub.js`     | **read-only**; „Cennik” = link do edytora, nie edycja                                                   |
| Panel wersji (modal)           | `public/js/shared/pricelistVersions.js`              | edycja + statusy + diff + eksport; CTA `publish`/`backdate` (aliasy)                                    |
| Sekcje studni                  | `public/partials/studnie/pricelist.html:49-159`      | DN1000…DN2500, Styczne, Dennice, Akcesoria, Przejścia, Kinety, Transport, Wkładki PRECO                 |
| Sekcje rur                     | `public/rury.html` + `public/js/rury/pricelistUi.js` | jedna tabela z kategoriami; transport = parametr dokumentu (`js/rury/transport.js`), **poza cennikiem** |
| Kafelki pulpitu admina         | `public/js/shared/dashboard.js:289-332`              | 3 kafelki z `/summary` (fail-soft)                                                                      |

### 2.3 Rozjazdy do zamknięcia (fakt — kod)

| #   | Rozjazd                                                                                                                                                                     | Dowód                                                                                                                  | Skutek                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | `POST /:id/approve` (kanoniczny) nie ma konsumenta w FE; FE woła aliasy `publish`/`backdate` oznaczone `Deprecation` + `Sunset 2027-03-31`                                  | `src/routes/pricelistVersions.ts:97-103, 354-373`; `public/js/shared/pricelistVersions.js:1462, 1653`                  | `checksStale` nie powstaje; alias `publish` omija guard noty ≥ 10 znaków dla daty wstecznej (`lifecycle.ts:417-422` vs `routes:415`) |
| R2  | SSoT instrukcja admina opisuje nieistniejący model (statusy `BACKDATE`/`BACKDATE_REQUESTED`, cron co 5 min, `/activate-due`, „Aktywuj” ze `SCHEDULED`, edycja zaplanowanej) | `docs/CENNIKI-INSTRUKCJA-ADMINA.md:24-28, 59-63, 74-81, 96-99, 182`                                                    | admin działa wg instrukcji, której nie ma w runtime                                                                                  |
| R3  | Martwe statusy w UI: `STATUS_LABELS`/`STATUS_ICONS`/legenda panelu, `STATE_LABELS` huba, 2 martwe opcje filtru                                                              | `public/js/shared/pricelistVersions.js:415-540, 883-889`; `public/js/cennikiHub.js:13-21`; `public/cenniki.html:74-75` | w bazie nie ma statusów legacy (2026-10-21) → te etykiety nigdy się nie pokażą; filtr stanów oferuje stany, których nie ma           |
| R4  | `canActivate`/`canBackdate` = `false` → gałęzie „Aktywuj”/„Zatwierdź wstecz” martwe                                                                                         | `public/js/shared/pricelistVersions.js:439-445`                                                                        | brak CTA do canonical approve; reszta kodu (`act === 'activate'`, `act === 'backdate'`) to dead code                                 |
| R5  | Brak wskaźnika „edytujesz szkic vs oferty liczą z obowiązującą” w edytorach                                                                                                 | `public/js/rury/pricelistUi.js`, `public/js/studnie/pricelistState.js`                                                 | admin widzi w edytorze szkic, a oferta liczy z innej wersji — ryzyko błędnych cen                                                    |
| R6  | Etykieta źródła cen w FE myląca: `__ruryPricingSource='live'` / `__studniePricingSource='live'` niezależnie od odpowiedzi BE                                                | `public/js/rury/dataService.js:114`; `public/js/studnie/uiHelpers.js:585`                                              | komentarz „cennik-admin zostaje na LIVE” nie odzwierciedla modelu                                                                    |
| R7  | Moduł `cenniki` nie jest admin-only; user/pro dostają 403 z `/summary`                                                                                                      | `public/app.html:156-164`; `public/js/spa/router.js:294-310`                                                           | user widzi pusty/zepsuty hub                                                                                                         |
| R8  | Brak w hubie komunikatu „bufor nie zmienia ofert” (plan centrum §5.1/§5.2)                                                                                                  | `public/cenniki.html:26-33`                                                                                            | ryzyko niezrozumienia, że edycja nie rusza ofert                                                                                     |

### 2.4 Stan migracji statusów — zweryfikowany 2026-10-21 (VERIFIED)

- Migracja `prisma/migrations/20261021000000_pricelist_approved/migration.sql` mapuje
  `ACTIVE/SCHEDULED/ARCHIVED/BACKDATE → APPROVED`, `BACKDATE_REQUESTED → DRAFT` i zakłada indeks
  `uq_pricelist_version_approved` (`type`,`effectiveFrom`) `WHERE status='APPROVED'`.
- `npx prisma migrate status` → „Database schema is up to date!" (34 migracji, EXIT 0) — **migracja wdrożona**.
- `npm run pricelist:preflight` → EXIT 0: 8 wersji, `APPROVED=8`, 0 kolizji, 0 nieznanych statusów,
  historia migracji obecna. W bazie **nie ma** statusów legacy (`BACKDATE`, `BACKDATE_REQUESTED`).
- `npm run pricelist:health` → EXIT 0: dokładnie 1 aktywna wersja na typ — rury `v3-20260928`
  (od 2026-09-28), studnie `v4-20261004` (od 2026-10-04), preco `v1`; 0 zapisów `LIVE_WRITE` w 24 h.
- Konsekwencje: `resolveActive` działa → oferty liczą z wersji obowiązującej (nie LIVE), badge „cennik vX”
  w ofertach żyje; etykiety `BACKDATE`/`BACKDATE_REQUESTED` w FE i 2 martwe opcje filtru w hubie to
  potwierdzona szkoda (R3); w bazie 0 szkiców (8/8 `APPROVED`) → „W przygotowaniu” = 0 do pierwszego szkicu.

## 3. Docelowy UI — kafelkowy (spójny z resztą S.O.K.)

Język UI panelu = **kafelki** (jak w pozostałych modułach S.O.K.), nie tabele-first.
Hierarchia 4 poziomów, każdy poziom = siatka kafelków: **OŚ → STAN → SEKCJA → POZYCJA**.

```
#cenniki (admin)    zakładki: Przegląd | Cennik | Historia
┌───────────────────────────────────────────────────────────────────────────────┐
│ PRZEGLĄD — kafelki osi (tiles-grid)                                           │
│  ┌── Rury ──────────┐ ┌── Studnie ─────────┐ ┌── PRECO ───────────┐           │
│  │ ● Obowiązuje v12 │ │ ● Obowiązuje v8   │ │ ● Obowiązuje v3    │           │
│  │   od 2026-10-01  │ │   od 2026-09-15    │ │   od 2026-08-01   │           │
│  │ [Podgląd][Kontrola][Opublikuj →]      │ │ [Podgląd][Kontrola]            │
│  ├─ Do wdrożenia ────┤ ├─ W przygotowaniu ┤ ├─ Do wdrożenia ─────┤           │
│  │ v13 · 2026-11-01 │ │ v9 · 1 szkic      │ │ v4 · 2026-11-01   │           │
│  └──────────────────┘ └───────────────────┘ └────────────────────┘           │
│  kafelki-podsumowanie: [Szkice 3] [Historyczne 7] [Kolizje 0] [Eksport]       │
├───────────────────────────────────────────────────────────────────────────────┤
│ CENNIK (read-only podgląd) — kafelki osi → kafelki sekcji → kafelki pozycji     │
│  [Rury] [Studnie] [PRECO]                    ← kafelki-osie (przełącznik)      │
│  ┌DN1000──┐┌DN1200──┐┌DN1500──┐┌DN2000──┐┌DN2500──┐┌Styczne─┐┌Dennice─┐      │
│  │12 poz. ││12 poz. ││12 poz. ││12 poz. ││12 poz. ││4 poz.  ││3 poz.  │      │
│  │Δ +3,2% ││Δ  0,0% ││Δ −1,4% ││Δ +0,8% ││Δ  0,0% ││Δ 0,0%  ││Δ +2,1% │      │
│  └────────┘└────────┘└────────┘└────────┘└────────┘└────────┘└────────┘      │
│  ┌Akcesoria┐┌Przejścia┐┌Kinety──┐┌Transport⟡┐┌Wkładki PRECO ⟡┐             │
│  │ 18 poz.  ││ 9 poz.  ││ 6 poz. ││ 1 poz.   ││ osobna oś     │             │
│  └──────────┘└─────────┘└────────┘└──────────┘└────────────────┘             │
│  klik w kafelek sekcji → kafelki pozycji (nazwa · cena · Δ · stan)            │
│  stan: ✎ Szkic v14 (7 zmian) │ ✓ obowiązuje v8 │ ◷ do wdrożenia v13           │
│  akcje: [Edytuj w module] [Opublikuj] [Kontrola] [Porównaj] [Zapisz wersję]   │
├───────────────────────────────────────────────────────────────────────────────┤
│ HISTORIA — kafelki wersji (kafelek = wersja)                                   │
│  ┌v9 · W przygotowaniu──┐┌v8 · Obowiązuje─────┐┌v6 · Historyczny─────┐        │
│  │ autor · data · użycie ││ 128 ofert/zamówień ││ 41 · 2026-06-11    │        │
│  │ nota · [Podgląd][Porównaj][Kontrola][Eksport][Klon][Usuń]                │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 3.0 Zasady kafelków (obowiązujące dla całego panelu)

- **Kafelek jest jednostką informacji.** Każdy kafelek: tytuł + 2–4 pola + akcje. Żadnych tabel
  w kafelku.
- **Tabela tylko tam, gdzie dane są z natury wierszowe i gęste:** lista cen > 30 pozycji w sekcji,
  historia > 20 wersji, eksport do druku. Tabela zawsze z alternatywą kafelkową lub drill-downem.
- **Drill-down zamiast przeładowania:** klik w kafelek osi → kafelki stanów; kafelek stanu → kafelki sekcji;
  kafelek sekcji → kafelki pozycji; kafelek pozycji → karta pozycji (cena, Δ, historia zmian).
  Głębokość linków = deep-link `#/cenniki/...` (działają w obu kierunkach).
- **Reuse zamiast nowych komponentów:** `.tile`, `.param-tile`, `.card`, `.card-sm`, `.card-compact`,
  `.tiles-grid`, `.nav-tile`, `.badge` / `.badge-ok` / `.badge-info` / `.badge-muted`, `.status-badge`
  (`docs/UI_GUIDELINES.md:109-118`). Nowe klasy tylko jako modyfikatory w `public/css/cenniki.css`
  (`.cenniki-tile--axis/--state/--section/--item`), bez nadpisań bazowych.
- **Tokeny, nie gołe wartości:** odstępy z `--tile-gap-*`, kolory z `style.base.css`; zero `style="…"`
  w HTML (CSP), zero nowych hexów.
- **Status = badge z ikoną**, nie sam kolor (a11y): Obowiązuje `badge-ok`, Do wdrożenia `badge-info`,
  W przygotowaniu `badge-muted`, Historyczny `badge-muted` (wyciszony).
- **Kafelek aktywny = `<button>`/`<a>`** z `aria-label` opisującym stan i liczebność
  („Studnie DN1000 — 12 pozycji, 3 zmienione”), widoczny `:focus-visible`.
- **Responsywność:** 1 kolumna < 600 px, 2 kolumny 600–1100 px, 3 kolumny > 1100 px
  (zgodne z `docs/UI_GUIDELINES.md:97`); kafelki osi/sekcji na gridzie auto-fit.
- **Gęstość:** na kafelku sekcji pokazujemy liczebność i Δ vs obowiązująca — szczegóły po kliknięciu
  (nie rozlewamy informacji na wszystkich kafelkach).

### 3.1 Mapowanie statusów (DB → UI)

| Zapisane w DB                            | Stan wyliczany | Etykieta UI                       | Warunek                                       |
| ---------------------------------------- | -------------- | --------------------------------- | --------------------------------------------- |
| `DRAFT`                                  | —              | **W przygotowaniu**               | status zapisany `DRAFT`                       |
| `APPROVED`                               | `SCHEDULED`    | **Do wdrożenia**                  | `effectiveFrom > now`                         |
| `APPROVED`                               | `ACTIVE`       | **Obowiązuje**                    | `effectiveFrom <= now`, najnowsza na osi typu |
| `APPROVED`                               | `ARCHIVED`     | **Historyczny**                   | wyparta przez nowszą `APPROVED`               |
| legacy `BACKDATE` / `BACKDATE_REQUESTED` | —              | _(etykieta martwa — usunąć w M1)_ | brak w bazie od 2026-10-21 (migracja S2a)     |

Reguły:

- **„Obowiązuje” nie jest zapisane** — to wynik resolvera. UI zawsze pokazuje datę („obowiązuje od …”).
- FE nie liczy dat samodzielnie — stan przychodzi z BE jako `state` (`GET /`, `/summary`).
- Jeden helper FE (`public/js/shared/pricelistVersions.js`): `stateOf` / `displayStatus` / `can*`.
- Styl statusów: Obowiązuje = zielony, Do wdrożenia = niebieski, W przygotowaniu = szary, Historyczny = wyciszony.

### 3.2 Decyzje projektowe (rozstrzygnięte 2026-10-21)

1. **Zakładka już istnieje** (`#/cenniki`) — rozszerzamy ją, nie tworzymy nowej.
2. **Admin-only**: kafelek nav + guard routera (user/pro → `#/rury`); BE i tak wymaga `requireAdmin`.
3. **Edycja: BEZ zagnieżdżonych iframe'ów i BEZ duplikacji kodu siatki.** Panel = warstwa sterowania +
   **read-only podgląd treści z API** (`GET /:id/preview` dla szkicu/aktywnej + `GET /:id/diff?against=<aktywna>`
   dla Δ). Edycja pozostaje w istniejących edytorach (`#/rury`, `#/studnie`), do których panel linkuje.
    - _Dlaczego nie iframe:_ panel `cenniki.html` już jest iframe'em w SPA, więc iframe w iframe daje
      zagnieżdżenie, podwójny chrome modułu i zerwany łańcuch `window.parent` (rury/studnie operują na
      `window.parent`: `public/js/studnie/globals.js:429-444`, `public/js/rury/offerNavigation.js:41-57`).
    - _Dlaczego nie przeniesienie kodu siatki do `cennikiHub.js`:_ druga kopia renderu kategorii, edycji
      komórek, zapisu i importu XLSX = najdroższy możliwy drift (cena błędna w ofercie). Odrzucone.
    - _Podgląd „edytowanego cennika z jednego miejsca”_ spełnia właśnie read-only podgląd szkicu z Δ względem
      obowiązującej wersji — bez kopiowania edytora.
4. **Zakładka „Cennik” w modułach rur/studni ZOSTAJE** — to istniejące miejsce pracy admina i miejsce
   edycji; usunięcie łamie nawyk, deep-linki (`#/rury?tab=pricelist`) i `openRuryVersionsPanel`. Dostaje
   **pasek stanu** (Szkic vs Obowiązuje) + link „Panel cenników” (`#/cenniki`).
5. **PRECO to osobna oś**, nie sekcja studni: studnia wskazuje PRECO przez resolver po dacie
   (`export.ts:579-596`, `PRECO_REFERENCE_STATUSES=['APPROVED']`). Zakładka „Wkładki PRECO” w studniach
   edytuje treść osi PRECO, ale **publikacja studni ≠ publikacja PRECO**.
6. **Transport: nie osobna oś — sekcja informacyjna w osi Rury i osi Studnie.** Model potwierdzony kodem:
    - w cenniku (wersjonowane): pozycja kursu `TR-RURY` („Transport rur (kurs)") / `TR-STUDNIE`
      („Transport studni (kurs)"), `category = 'Transport'`, **cena 0** (`data/seed_rury.json:678-685`,
      `data/seed_studnie.json:21019-21033`) + kolumna „Ilość/transport” per produkt;
    - poza cennikiem (parametry dokumentu oferty/zamówienia, **niewersjonowane**): cena kursu
      `transportKm × transportRate` (`public/js/rury/transport.js:93`, `public/js/studnie/offerTransport.js:9`),
      limit 24 t/kurs (`src/services/ruryTransport.ts:10`), tryb `transportSeparate` (kurs jako osobna pozycja
      `TR-*` vs wliczony w pozycje).
    - Wniosek: **cena kursu nie jest cennikiem** → transport nie ma własnej osi wersji i osobnego lifecycle'u.
      Sekcja „Transport” w panelu pokazuje: pozycję kursu (`TR-*`), produkty z ilością/transport oraz 3 linie
      faktu (cena kursu = km × stawka, 24 t/kurs, tryb kursu). Zmiany tych parametrów nie ma w panelu —
      to nie jest cennik.
7. **Jedno CTA publikacji**: „Opublikuj” → `POST /:id/approve` (nie alias `publish`), z `effectiveFrom`,
   `note` (≥ 10 znaków dla daty ≤ now) i `checksCheckedAt`; odpowiedź `checksStale` → ostrzeżenie, nie błąd.
8. **Kontrola przed publikacją** (`GET /:id/checks`) = doradcza; publikacja waliduje krytyczne warunki w tx.
9. **Bufor nie zmienia ofert** — komunikat w hubie i w edytorach (zamknięcie R5/R8).

## 4. Zakres zmian w kodzie

### Backend — model bez zmian

| Plik                              | Zmiana                                                                                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| —                                 | Brak zmian modelu/statusów/migracji. Wyjątek: ewentualne `activeVersionId`/`draftVersionId` w `GET /summary` — **YAGNI: FE ma `GET /`** (odstępuje). |
| `src/routes/pricelistVersions.ts` | Bez zmian kontraktu; potwierdzić, że `Deprecation`/`Sunset` aliasów nie kolidują z FE po M1.                                                         |

### Frontend

| Plik                                                                   | Zmiana                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/js/spa/router.js`                                              | guard modułu `cenniki`: brak admina → redirect `#/rury`; sekcje modułu zgodne z 3 warstwami.                                                                                                                                                                                              |
| `public/app.html`                                                      | kafelek `spa-app-cenniki` widoczny tylko dla admina (toggle po roli, jak `admin-panel`).                                                                                                                                                                                                  |
| `public/js/cennikiHub.js`                                              | warstwa 1 (oś per typ, statusy, CTA) + warstwa 2 (read-only podgląd treści z `preview`/`diff`) + warstwa 3 (historia/oś czasu) + banner „bufor nie zmienia ofert” + badge stanu + sekcja Transport (info).                                                                                |
| `public/cenniki.html`                                                  | sekcje: Rury / Studnie (tabs 1:1 z edytorem, sekcja Transport jako podgląd) / PRECO osobno; filtr stanów tylko 4 realne (bez `BACKDATE*`).                                                                                                                                                |
| `public/js/shared/pricelistVersions.js`                                | `publish`/`backdate` → `approve` (+`checksCheckedAt`, `checksStale`); usunięcie `BACKDATE*`, `canActivate`, `canBackdate` i martwych gałęzi `act==='activate'/'backdate'`; 4 etykiety + „Do wdrożenia”; `stateOf` jako jedyne źródło porównań statusów.                                   |
| `public/js/rury/pricelistUi.js`, `public/js/studnie/pricelistState.js` | pasek stanu edycji (✎ Szkic vN · ✓ Obowiązuje vM) + link „Panel cenników” (`#/cenniki`); toast „Zapisano szkic — opublikuj wersję”. Zakładka „Cennik” zostaje (decyzja 4).                                                                                                                |
| `public/js/rury/dataService.js`, `public/js/studnie/uiHelpers.js`      | poprawa `__*PricingSource` (wartość z odpowiedzi BE, nie hardcoded `'live'`).                                                                                                                                                                                                             |
| `public/css/cenniki.css`                                               | przebudowa panelu na kafelki: `.cenniki-tile` + modyfikatory `--axis/--state/--section/--item`, siatki `.tiles-grid`, odstępy z `--tile-gap-*`; wycofanie dotychczasowych `.cenniki-cards`/`.cenniki-card` (lub przebudowa na modyfikatory). Bez gołych `gap`/hexów, bez inline `style=`. |

### Dokumentacja

| Plik                                | Zmiana                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/CENNIKI-INSTRUKCJA-ADMINA.md` | przepisanie na model 2 statusów + 4 etykiety UI + `approve` + brak crona/`activate-due`/„Aktywuj” + ścieżka „Szkic → Opublikuj → Do wdrożenia → Obowiązuje”. |
| `docs/API.md`                       | opisać `POST /:id/approve` jako kanoniczny (aliasy `publish`/`activate`/`backdate` jako deprecated, Sunset 2027-03-31).                                      |
| `README.md`                         | (opcjonalnie) wzmianka o module „Cenniki — panel sterowania”.                                                                                                |

### Testy

- `tests/pricelistVersions.*` — FE: `state` → 4 etykiety, `canPublish`/`canDelete` na stanach (nie statusach).
- nowy: FE wywołuje `POST /:id/approve` (nie `publish`), obsługa `checksStale=true` (200, ostrzeżenie).
- nowy: admin-gating modułu `cenniki` (user → redirect).
- nowy: PRECO jako osobna oś (nie pod studniami) w hubie.
- nowy: panel renderuje kafelki, nie tabele — asercja braku `<table>` w warstwie stanów i sekcji
  (tylko warstwa historii przy > 20 wersjach dopuszcza tabelę); obecność `aria-label` na kafelkach aktywnych.
- `tests/frontend/pricelistImportDraft.test.ts` — regresja importu (import → DRAFT, nie APPROVED).
- `test:axe` — 4 widoki panelu (Przegląd / Cennik / Historia + modal kontroli).
- `test:e2e-pricelist-preview:spawn` — hub + preview + diff.

## 5. Etapy (autonomia per `docs/AUTONOMY_CONTRACT.md`)

| #      | Etap                     | Zakres                                                                                                                                                                                                                                                                                                                   | Brama                                                                                                                                       | Klasyfikacja                  |
| ------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **M0** | Docs                     | Przepisanie `CENNIKI-INSTRUKCJA-ADMINA.md` + `docs/API.md` na model 2 statusów i 4 etykiety                                                                                                                                                                                                                              | `npm run version:check`, `npm run format`                                                                                                   | 🟢 działanie + raport         |
| **M1** | FE correctness           | `publish`→`approve` (+`checksStale`), usunięcie martwych statusów/legendy/filtru, `can*` na 4 stanach, alias-note guard, poprawka `__*PricingSource`                                                                                                                                                                     | `npm run typecheck:frontend`, `npm run lint:frontend`, `npm run test:quick`, `npm run test:frontend`                                        | 🟡 GO na paczkę               |
| **M2** | Admin-only + kafelki osi | Gating kafelka i routera, warstwa 1 w hubie jako **siatka kafelków osi** (oś → kafelki stanów: Obowiązuje / Do wdrożenia / W przygotowaniu / Historyczny, z datą, liczebnością, kolizjami, użyciem), banner „bufor nie zmienia ofert”                                                                                    | `npm run test:quick`, `npm run test:axe`                                                                                                    | 🟡 GO na paczkę               |
| **M3** | Podgląd + publikacja     | Warstwa 2 w hubie jako **drill-down kafelkowy**: kafelki osi → kafelki sekcji (liczebność + Δ vs obowiązująca) → kafelki pozycji (nazwa, cena, Δ, stan); źródło `GET /:id/preview` + `GET /:id/diff?against=<aktywna>`; pasek stanu w edytorach + link do panelu; CTA „Opublikuj” z kontrolą (bez zagnieżdżonego iframe) | `npm run typecheck:frontend`, `npm run lint:frontend`, `npm run test:quick`, `npm run test:e2e-pricelist-preview:spawn`, `npm run test:axe` | 🟡 GO na paczkę               |
| **M4** | Sekcje                   | Sekcje studni 1:1 z edytorem + osobna oś PRECO w panelu + sekcja Transport (info: pozycja kursu `TR-*` + produkty z ilością/transport + parametry kursu poza cennikiem)                                                                                                                                                  | `npm run test:quick`                                                                                                                        | 🟡 GO na paczkę               |
| **M5** | Weryfikacja runtime      | Migracja S2a **już wdrożona** (2026-10-21, `migrate status` OK) → etap = weryfikacja widocznego efektu: hub pokazuje aktywną wersję/typ, kafelki pulpitu nie „brak aktywnej", oferta liczy z wersji (badge „cennik vX"), brak toasta fallbacku LIVE                                                                      | `npm run pricelist:health` (EXIT 0) + `npm run pricelist:preflight` (EXIT 0) + ręczna obserwacja UI + `npm run test:quick`                  | 🟢 weryfikacja (bez migracji) |
| **M6** | Domknięcie               | Warstwa 3 jako **kafelki wersji** (kafelek = wersja: badge stanu, data, autor, użycie, nota, akcje) + opcjonalny widok tabelaryczny przy > 20 wersjach; dzienny health check „1 aktywna wersja/typ” (`health.ts`), metryki                                                                                               | `npm run test:quick`, `npm run validate`                                                                                                    | 🟡 GO na paczkę               |

Rollback: wszystkie etapy → revert commitów. Migracja S2a jest już wdrożona w bazie — wycofanie jej wymagałoby
`npm run restore data/backups/backup_*.sqlite` (przed zmianą stanu cenników) i nie jest planowane.

## 6. Ryzyka i mitigacje

| Ryzyko                                                  | Mitigacja                                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Duplikacja edytora siatki → drift cen                   | odrzucone obie alternatywy (decyzja 3): podgląd z API, edycja w istniejącym edytorze — zero kopii kodu        |
| Admin widzi szkic, oferta liczy z innej wersji          | badge trybu w edytorach (M3) + banner w hubie (M2)                                                            |
| Korekta wsteczna bez uzasadnienia przez alias `publish` | M1: FE tylko `approve`; alias zostaje z `Deprecation`                                                         |
| Migracja S2a bez backupu                                | wykonana 2026-10-21 (backup + preflight EXIT 0); stan potwierdzony `migrate status`/health — ryzyko zamknięte |
| Rozjazd UI po migracji (statusy `BACKDATE*`)            | migracja wdrożona 2026-10-21, w bazie brak statusów legacy → M1 usuwa martwe etykiety/legendę/filtry          |
| Rozjazd dokumentacji                                    | M0 przed M1–M4 (instrukcja = kontrakt dla admina)                                                             |
| Koszt: 2 iframe'y (rury + studnie)                      | iframe tworzony leniwie, tylko dla aktywnej osi                                                               |

## 7. Non-goals

- Nowy edytor siatki / własna tabela cen / drag&drop cen.
- Drugi dashboard (panel = warstwa sterowania, nie osobna strona).
- Scalenie PRECO ze studniami; kopiowanie wierszy PRECO do wersji studni.
- Nowy schemat statusów (2 statusy zapisane wystarczą).
- Usuwanie tabel LIVE i `*_Default` (S6 — poza v1, osobny GO + bramka O3).
- Osobna oś wersji dla transportu (cena kursu jest parametrem dokumentu oferty) — sekcja Transport w panelu
  jest informacyjna; edycja transportu zostaje w modułach (studnie: zakładka Transport, rury: modal oferty).
- Paginacja Historii (8–100 wersji).
- Wersjonowanie per podsekcja (DN1000 osobno) — oś czasu jest per typ.

## 8. Rozstrzygnięte pytania (2026-10-21)

1. **Widoczność modułu:** **admin-only** (kafelek nav i guard routera; user/pro → redirect `#/rury`).
   User nadal widzi badge „cennik vX” w ofercie.
2. **Edycja w panelu:** ani iframe, ani przeniesienie kodu siatki → **read-only podgląd z API**
   (`GET /:id/preview` + `GET /:id/diff`) w panelu + **edycja w istniejących edytorach** (`#/rury`,
   `#/studnie`) z paskiem stanu i linkiem do panelu. Uzasadnienie: zagnieżdżony iframe psuje łańcuch
   `window.parent` (edytory operują na parent), a kopia kodu siatki = drift cen. → decyzja 3.
3. **Zakładka „Cennik” w modułach rur/studni:** **zostaje** (miejsce edycji + deep-linki + modal wersji),
   dostaje pasek stanu i link do panelu. → decyzja 4.
4. **Transport:** **nie osobna oś wersjonowania** — sekcja informacyjna w osi Rury i osi Studnie
   (pozycja kursu `TR-RURY`/`TR-STUDNIE`, produkty z ilością/transport, parametry kursu jako fakty:
   cena = km × stawka, 24 t/kurs, tryb `transportSeparate`). Cena kursu jest parametrem oferty, nie cennikiem.
   → decyzja 6.

## 9. Evidence ledger (do wypełnienia przy realizacji)

| ID    | Twierdzenie                                                                                                                                                                                         | Dowód                                                                                                                                                                                                                        | Status   |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| E-001 | Model statusów = 2 zapisane + 3 wyliczane                                                                                                                                                           | `validation.ts:32-61`                                                                                                                                                                                                        | VERIFIED |
| E-002 | FE nie wywołuje `POST /:id/approve`                                                                                                                                                                 | `public/js/shared/pricelistVersions.js:1462, 1653` (grep `/approve` w `public/` → 0 trafień w kontekście cenników)                                                                                                           | VERIFIED |
| E-003 | Alias `publish` omija guard noty dla daty wstecznej                                                                                                                                                 | `lifecycle.ts:417-422` (`publishDraft` → `approveVersion` bez `requirePastNote`) vs `routes:415`                                                                                                                             | VERIFIED |
| E-004 | Moduł `cenniki` nie jest admin-only                                                                                                                                                                 | `app.html:156-164`, `router.js:294-310` (brak kontroli roli)                                                                                                                                                                 | VERIFIED |
| E-005 | Migracja S2a **wdrożona**; w bazie brak statusów legacy                                                                                                                                             | `npx prisma migrate status` → „Database schema is up to date!" (EXIT 0); `npm run pricelist:preflight` → `APPROVED=8`, 0 kolizji (EXIT 0); `npm run pricelist:health` → 1 aktywna wersja/typ (EXIT 0)                        | VERIFIED |
| E-006 | Edytor pokazuje DRAFT, oferta liczy z ACTIVE                                                                                                                                                        | `writeTarget.ts:40-45`, `productsV2.ts:46-52` vs `app.js:139`                                                                                                                                                                | VERIFIED |
| E-007 | Transport: `TR-RURY`/`TR-STUDNIE` to pozycje kursu w cenniku (cena 0); cena kursu (km × stawka), limit 24 t/kurs i tryb `transportSeparate` to parametry dokumentu oferty — poza `PricelistVersion` | `data/seed_rury.json:678-685`, `data/seed_studnie.json:21019-21033`, `src/services/ruryTransport.ts:10`, `public/js/rury/transport.js:93`, `public/js/studnie/offerTransport.js:9`, `src/validators/orderSchemas.ts:358-359` | VERIFIED |

## 10. Definition of Done

- Panel zbudowany **na kafelkach** w 4 poziomach (oś → stan → sekcja → pozycja), zgodnie z
  `docs/UI_GUIDELINES.md` (`.tile` / `.card` / `.tiles-grid` / `--tile-gap-*`, brak własnych hexów i inline
  stylów, status jako badge z ikoną); tabele tylko dla gęstych list (> 30 pozycji / > 20 wersji).
- Moduł `#/cenniki` widoczny i dostępny **tylko** dla admina; user/pro → redirect.
- Panel pokazuje dla każdej osi (Rury/Studnie/PRECO): Obowiązuje (z datą), Do wdrożenia, W przygotowaniu,
  Historyczne, kolizje dat, liczbę szkiców, użycie aktywnej wersji.
- Sekcje treści dostępne z panelu jako **read-only podgląd** (rury; studnie: DN1000…Kinety + Transport;
  PRECO osobna oś), z Δ względem obowiązującej wersji; **edycja pozostaje w modułach `#/rury` / `#/studnie`**,
  gdzie zakładka „Cennik” zostaje i pokazuje jawny wskaźnik trybu (Szkic vs Obowiązuje).
- Sekcja Transport w obu osiach pokazuje pozycję kursu (`TR-RURY` / `TR-STUDNIE`), produkty z ilością/transport
  oraz parametry kursu oznaczone jako „poza cennikiem”.
- Publikacja idzie przez `POST /:id/approve` (bez aliasów), z kontrolą przed publikacją i obsługą `checksStale`.
- Historia/oś czasu: status, data, autor, użycie, notatka, akcje (Podgląd/Porównaj/Kontrola/Eksport/Klon/Usuń).
- Instrukcja admina i `docs/API.md` opisują **aktualny** model (2 statusy + 4 etykiety, `approve`, brak crona).
- Bramki zielone: `npm run version:check`, `npm run validate` (w tym `test:quick`), `npm run format`,
  `npm run encoding:check`; testy `test:axe` i `test:e2e-pricelist-preview:spawn` PASS.
- Migracja statusów (S2a) potwierdzona wdrożona 2026-10-21; M5 = weryfikacja widocznego efektu w UI.
