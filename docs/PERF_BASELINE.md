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
- P0: claim numerów 1× `count=N` → chunki 200 (2920 → 15 claimów).
- P1-C: `chunkedCreateMany` 25 (seed + priceOverrideService).
