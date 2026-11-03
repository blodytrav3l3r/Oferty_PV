# Baseline wydajności S.O.K. (brama regresji)

> Nie dokładać mechanizmów „na zapas" — decyzje tylko na podstawie pomiaru lub triggera.
> Surowe limity (CLAIM_RANGE_MAX, batch 200, limit 50 MB) to safety capy, nie mechanizmy.

## P1-B — DEFAULT ON = TRUE (2026-09-06)

```text
DEFAULT ON = TRUE

OFF only via:
  ?virtual=0
  localStorage override (sok_excel_virtual=0)

Legacy renderer:
  diagnostic/oracle path only
  never implicit fallback

Regression gates:
  npm run test:parity   # 31/31 hash-równe OFF=ON
  npm run test:bench    # liczby poniżej
```

## Baseline Excel virtual vs legacy (2026-09-06, headless Chromium)

| Metryka            | 1k OFF  | 1k ON  | 5k OFF  | 5k ON  |
| ------------------ | ------- | ------ | ------- | ------ |
| Otwarcie modala    | 6,4 s   | 0,6 s  | 32 s    | 0,6 s  |
| Węzły DOM          | 139 306 | 12 039 | 679 306 | 12 039 |
| Edycja wiersza     | 2,6 s   | ~0 s*  | 43 s    | ~0 s*  |
| Scroll 0→100→0 ×10 | const   | flat   | const   | flat   |

\* `editMs` zawiera 1,2 s sztucznego waita harnessu — wartość realna poniżej.

Wniosek: DOM w ON stały (~12k z chromem strony) niezależnie od N; legacy nie do użytku przy tysiącach wierszy.

## Historia progów

- 2026-09: 1k → ~61 ms / 11 MB, 5k → ~323 ms / 58 MB, 10k → ekstrapolacja ~646 ms / 120 MB (pełny DOM, przed virtual default).
- P1-A: `wellsExport` 8,57 MB → 0,48 MB (−94,5%); rekord 18,7 MB → ~10,7 MB.
- P0: search PZ 18 MB × 60 (1,1 GB result set, napi fail) → `json_extract(orderNumber)`.

## Baseline initial-load SPA (P1.6, 2026-09-30, headless Chromium)

Harness: `npm run perf:baseline` (`tests/playwright/perfBaseline.cjs --spawn`;
build + push/seed `data/perf-baseline.sqlite` + serwer :3178).
Metodologia: cold (świeży kontekst) + warm ×3 na stronę, mediana;
1 login na przebieg (cookie wstrzykiwane — limiter loginów 10/min);
`PERF_ONLY=a,b` filtruje strony, `PERF_OUT` nadpisuje JSON.

| Strona      | req | api |  me | jsKB | resKB | DCL | load | err |
| ----------- | --: | --: | --: | ---: | ----: | --: | ---: | --: |
| index       |  58 |  22 |   1 |   80 |   288 | 608 |  608 |   0 |
| app         | 130 |  14 |   2 |   54 |   232 | 514 |  515 |   0 |
| app-studnie | 254 |  19 |   2 |   54 |   235 | 484 |  484 |   0 |
| app-rury    | 130 |  14 |   2 |   54 |   232 | 461 |  467 |   0 |
| studnie     | 451 |  12 |   2 |   54 |   105 |  69 |   70 |   4 |
| rury        | 147 |   7 |   2 |   80 |   128 |  68 |   68 |   4 |
| kartoteka   |  82 |   7 |   2 |   80 |   128 |  72 |   72 |   4 |
| zlecenia    |  94 |   6 |   2 |   80 |   128 |  80 |   80 |   4 |

Artefakty pomiarowe (nie bugi — nie „naprawiać"):

- `err=4` na 4 stronach to 429 z `apiLimiter` (300/15 min/IP): harness
  strzela ~1300 requestów z 1 IP. Limiter działa zgodnie z projektem.
- `jsKB` zaniżone na standalone: po `location.replace` mierzymy dokument
  app-shell (38 entries Resource Timing), nie porzucony exemplar.
  Realny download JS studnie.html = 5,46 MB (386 odpowiedzi, dev `no-store`).
- `me=2` = dokument shell + dokument iframe (CDP frame tracking).
  Każdy dokument woła `/me` co najmniej raz — wzorzec poprawny (P1.8: brak akcji).
  Od 2026-11-03 pomiar daje `me=3..4`: ramka modułu woła `/me` raz (dwa razy dla
  pulpitu — patrz sekcja niżej), a shell dwa razy (przyczyna nieustalona; do
  sprawdzenia osobno, poza zakresem pomiaru montowania).

Wniosek P1.7 (451 req studnie.html): duplikaty ×2 z identycznym URL, oba
`init=parser` (CDP) — standalone parsuje 182 tagi, potem `spaRedirect.js`
(`location.replace('/app.html#/studnie')`) ładuje ten sam dokument w iframe
(2. pass). By-design migracji SPA (deep linki działają); DCL ≤ 600 ms.
Prod: `max-age 7d` + `?v=` → 2. pass z disk cache. Brak akcji.

- P0: claim numerów 1× `count=N` → chunki 200 (2920 → 15 claimów).
- P1-C: `chunkedCreateMany` 25 (seed + `src/services/pricelist/{bootstrap,validation}.ts`).
- Bramy load/E5: `docs/plans/archive/e3-perf.md`, werdykty E5: `docs/plans/archive/e5-decision.md`.

> 2026-11-03: harness mierzy też `app-pulpit` (`#/pulpit`), ramkę modułu (pierwsze
> montowanie) i startuje dopiero po wyciszeniu ruchu — liczby z tej sekcji **nie są
> porównywalne** z tabelą powyżej (tam stała pauza 2,5 s). Artefakt:
> `docs/plans/p16-baseline.json`.

## Pulpit jako moduł SPA — waga pierwszego montowania (2026-11-03, headless Chromium)

Harness: `node tests/playwright/perfBaseline.cjs --spawn` (build + seed
`data/perf-baseline.sqlite` + serwer :3178). Mediana z 3 cold + 3 warm; odczyt po
bramce spokoju (liczba wpisów Resource Timing stabilna przez ≥1 s) zamiast stałej
pauzy, bufor Resource Timing podniesiony do 5000 wpisów (domyślne 250 ucinało
`studnie.html`, 229 wpisów). Ramka modułu mierzona własnym Resource Timing
(dokument + subzasoby); wiersze `ramka` istnieją tylko dla `/app.html`, bo
`index.html`/`*.html` robią redirect do shella i to ten sam montaż.

| Ramka modułu (pierwsze montowanie) | req | api |  me | jsKB |   KB | DCL | load |
| ---------------------------------- | --: | --: | --: | ---: | ---: | --: | ---: |
| `index.html?host=pulpit&v=2.0`     |  83 |  35 |   1 |  167 |  275 |  52 |   52 |
| `studnie.html?v=2.0`               | 229 |  13 |   1 |  928 | 1071 | 166 |  166 |
| `rury.html?v=2.0&tab=builder`      | 102 |   8 |   1 |  309 |  395 |  74 |   74 |
| `kartoteka.html?v=2.0`             |  67 |   7 |   1 |  214 |  268 |  61 |   61 |
| `zlecenia.html?v=2.0`              |  33 |   4 |   1 |   84 |  139 |  31 |   31 |

Shell `app.html#/pulpit`: 123 req / 43 api / 2 me / 76 jsKB / 267 KB / DCL 90 /
load 144. Pełne pierwsze wejście na trasę: **~542 KB** (267 KB shell + 275 KB
ramka) i **123 żądania** (w tym tylko **2 wywołania `/api/auth/me`**: dokładnie
1 w shellu i dokładnie 1 w ramce pulpitu).

Wnioski:

- Wiersz `shell` miesza dwa źródła: `req`/`api`/`me` pochodzą z CDP
  (`page.on('response')` = wszystkie ramki, więc **zawierają** ramkę), a
  `jsKB`/`KB` z Resource Timing dokumentu głównego (= tylko shell). Dlatego
  żądań nie sumuje się (123 to już całość), a bajty tak (267 + 275). Wagę
  montowania czyta się z wiersza `ramka`.
- Pulpit jest trzeci od końca pod względem bajtów (275 KB; mniejsze są zlecenia
  139 KB i kartoteka 268 KB), ale **najcięższy pod względem API: 35 wywołań
  `/api/*`** (pozostałe moduły 4–13). Kafelki pulpitu pobierają dane niezależnie
  od siebie — to one, nie JS, decydują o czasie do gotowego ekranu.
- JS ramki (167 KB) to wszystkie skrypty strony wejścia ładowane w `index.html`.
  To więcej niż JS dokumentu głównego shella (76 KB), ale mniej niż rury (309 KB)
  i studnie (928 KB).
- DCL/load ramki (52/52 ms) dotyczą samego dokumentu; realna gotowość UI czeka na
  `/me` i 35 odpowiedzi API, czego Resource Timing nie obejmuje. Nie traktować
  tych liczb jako TTI.
- `cacheHits=0` we wszystkich przebiegach cold (dev `no-store`), więc wiersz
  `ramka` to pełna waga modułu, nie tylko przyrost po shellu.
- `me=1` w ramce pulpitu i `me=2` w shellu (dokładnie 1 /me w dokumencie shella
  oraz 1 /me w dokumencie ramki): `probeEmbeddedSession()` (`dashboard.js`)
  i `authReady()` współdzielą jeden request przez `window.meProbe` (`shared/auth.js`),
  a router shella i panel wersji współdzielą `authReady()`. Zero duplikatów.
- Ponowne wejście na `#/pulpit` nie montuje ramki drugi raz — router trzyma iframe
  (`router.js:747-755`, reload tylko przy zmianie `edit`/`order`). Waga płaci się
  raz na sesję, nie przy każdym przełączeniu trasy.
- Wiersz `index` w tabeli wyżej (2026-09-30) opisywał stronę logowania. Po zmianie
  z 2026-11-03 logowanie w oknie najwyższym kończy się w `app.html#/pulpit`, więc
  dzisiejszy pomiar `index` mierzy już shell z ramką pulpitu (82 req / 399 KB).
  To zachowanie produktu, nie regresja — dlatego starej tabeli nie przelicza się
  tym samym przebiegiem.
- Szum pomiaru: ±2 żądania i ±20 KB między przebiegami (dev `no-store`, zimny start
  serwera). Progi regresji dopiero po 2–3 powtórzeniach na tym samym hoście.

## Baseline opieki P0 (2026-10-14, syntetyczne SQLite, scope=all)

Mediany per-op na `careService.ts` (user admin, limit 50):

| op                      | 400 ofert | 5 000 | 20 000 | po P0 (20k)                    |
| ----------------------- | --------- | ----- | ------ | ------------------------------ |
| `getCareEtagInput`      | 1 ms      | 3 ms  | 17 ms  | 17 ms (bez zmian — tanio)      |
| `getCareSummary`        | 4 ms      | 39 ms | 177 ms | 177 ms (bez zmian)             |
| `getCareQueue`          | 16 ms     | 74 ms | 274 ms | 228 ms                         |
| w tym count             | —         | —     | 232 ms | 3 ms (bez CTE latest, P0.4)    |
| `syncCareNotifications` | 8 ms      | 85 ms | 355 ms | 0 ms hot (throttle 60 s, P0.3) |
| `listCareNotifications` | 1 ms      | 1 ms  | 1 ms   | 1 ms (capped)                  |

Wzrost w przybliżeniu liniowy. Ekstrapolacja 1M (INFERENCE, nie pomiar):
panel ~40 s przed P0; po P0 dominuje sort CTE `latest` w data+summary —
temat bramki P1 (`latest_followup`). Enrich po LIMIT odrzucony pomiarem
(14% na kopii z `data=NULL`).

## Opieka P1 (2026-10-14): latest_followup zamiast CTE (20k, scope=all)

| op                             | przed P1 | po P1                                |
| ------------------------------ | -------- | ------------------------------------ |
| `getCareSummary`               | 177 ms   | 30 ms (5.9×)                         |
| `getCareQueue` p1 (data+count) | 228 ms   | 92 ms (2.5×; count 3 ms, data 81 ms) |
| panel ≈ suma                   | ~470 ms  | ~140 ms (3.4×)                       |

Równoważność: dump 20 000 wierszy + summary + sync + notifs IDENTYCZNY
bajt-w-bajt (stary CTE vs tabela). Ekstrapolacja 1M: ~7 s (dominuje sort
`ORDER BY` pełnego zbioru + GROUP BY summary — sufit bez zmiany architektury).
Ocena przy 1M: 5/10 (było 3/10).

## Opieka P2.2 (2026-10-14): leniwe wzbogacanie strony

Pomiar pokazał: sort ~3 ms, enrich JSON ~60 ms ze 105 ms data query.
Faza 1 (skalary + ORDER + LIMIT 51) + faza 2 (pełne kolumny dla ≤51 par
`(kind,id)`, merge w JS). Bez zmian DTO/kursora/totalCount.

| op (20k)     | przed P2.2 | po P2.2      |
| ------------ | ---------- | ------------ |
| `queue_data` | 226 ms     | 41 ms (5.5×) |
| panel ≈ suma | ~140 ms    | ~100 ms      |

Ekstrapolacja 1M: ~7 s → ~2.5 s. Ocena przy 1M: 6/10 (zostaje skan
pełnego zbioru + GROUP BY summary; sufit SQLite).
Rozrzut pomiarów do ~2× pod obciążeniem hosta — mediany 3–5 powtórzeń.
