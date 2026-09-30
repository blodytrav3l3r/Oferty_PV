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
  Każdy dokument woła `/me` dokładnie raz — wzorzec poprawny (P1.8: brak akcji).

Wniosek P1.7 (451 req studnie.html): duplikaty ×2 z identycznym URL, oba
`init=parser` (CDP) — standalone parsuje 182 tagi, potem `spaRedirect.js`
(`location.replace('/app.html#/studnie')`) ładuje ten sam dokument w iframe
(2. pass). By-design migracji SPA (deep linki działają); DCL ≤ 600 ms.
Prod: `max-age 7d` + `?v=` → 2. pass z disk cache. Brak akcji.

- P0: claim numerów 1× `count=N` → chunki 200 (2920 → 15 claimów).
- P1-C: `chunkedCreateMany` 25 (seed + priceOverrideService).
- Bramy load/E5: `docs/plans/archive/e3-perf.md`, werdykty E5: `docs/plans/archive/e5-decision.md`.
