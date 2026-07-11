# Audyt XSS — WITROS Oferty PV

**Data**: 2026-07-11
**Generator**: `scripts/generate-xss-audit.js`
**Ignore DB**: `docs/security/xss-ignore.json` (66 suppressed)
**Classification**: `docs/security/xss-classification.json` (0 entries)
**Zakres**: `public/js/**/*.js` — innerHTML, insertAdjacentHTML, outerHTML, onclick/onchange/oninput/onmouseenter/onmouseleave/onerror/onload handlers

---

## Scanner Score

> Wynik skanera (0–100). Odróżnij od rzeczywistego poziomu bezpieczeństwa — skaner nie analizuje przepływu danych, logiki backendu ani kontekstu biznesowego.

**100/100**

### Escape Coverage (tooling metric)

> Udział dynamicznych sinków (konkatenacja lub template literal) zabezpieczonych `escapeHtml()`. Nie odzwierciedla rzeczywistego poziomu bezpieczeństwa — statyczne literały liczone jako nieosłonięte zaniżają wynik.

**100%** (0/0 dynamiczne innerHTML/insertAdjacentHTML z escapeHtml)

| Dynamiczne sinki | Z escapeHtml | Coverage |
| ---------------- | ------------ | -------- |
| 0                | 0            | 100%     |

### CSP Readiness (tooling metric)

**0** total inline event handlers (XSS003)
Przed usunięciem `'unsafe-inline'` z CSP wszystkie muszą być przeniesione do `addEventListener` lub event delegation.

### Security Debt

| Sprint | Total | HIGH | MEDIUM | REVIEW |
| ------ | ----- | ---- | ------ | ------ |

### Scanner Gate

| Kryterium      | Wymóg | Obecnie | Status |
| -------------- | ----- | ------- | ------ |
| CRITICAL = 0   | 0     | 0       | ✅     |
| HIGH = 0       | 0     | 0       | ✅     |
| MEDIUM ≤ 10    | ≤ 10  | 0       | ✅     |
| REVIEW = 0     | 0     | 0       | ✅     |
| Coverage ≥ 95% | ≥ 95% | 100     | ✅     |

### Delta (vs poprzednie uruchomienie)

| Metryka  | Poprzednio | Obecnie | Zmiana |
| -------- | ---------- | ------- | ------ |
| Score    | 100        | 100     | ➡️ 0   |
| CRITICAL | 0          | 0       | ➡️ 0   |
| HIGH     | 0          | 0       | ➡️ 0   |
| MEDIUM   | 0          | 0       | ➡️ 0   |
| REVIEW   | 0          | 0       | ➡️ 0   |
| Coverage | 100%       | 100%    | ➡️ 0%  |

### Trend

| Data       | Score | Total | HIGH | MEDIUM | REVIEW | Coverage |
| ---------- | ----- | ----- | ---- | ------ | ------ | -------- |
| 2026-07-11 | 98    | 246   | 0    | 8      | 56     | 54%      |
| 2026-07-11 | 98    | 246   | 0    | 8      | 56     | 54%      |
| 2026-07-11 | 98    | 246   | 0    | 8      | 56     | 54%      |
| 2026-07-11 | 100   | 246   | 0    | 1      | 0      | 54%      |
| 2026-07-11 | 100   | 246   | 0    | 0      | 0      | 54%      |
| 2026-07-11 | 100   | 246   | 0    | 0      | 0      | 54%      |
| 2026-07-11 | 100   | 246   | 0    | 0      | 0      | 54%      |
| 2026-07-11 | 100   | 246   | 0    | 0      | 0      | 54%      |
| 2026-07-11 | 100   | 246   | 0    | 0      | 0      | 54%      |
| 2026-07-11 | 100   | 246   | 0    | 0      | 0      | 54%      |
| 2026-07-11 | 100   | 246   | 0    | 0      | 0      | 54%      |
| 2026-07-11 | 100   | 246   | 0    | 0      | 0      | 54%      |
| 2026-07-11 | 100   | 0     | 0    | 0      | 0      | 100%     |
| 2026-07-11 | 100   | 0     | 0    | 0      | 0      | 100%     |
| 2026-07-11 | 100   | 0     | 0    | 0      | 0      | 100%     |
| 2026-07-11 | 100   | 0     | 0    | 0      | 0      | 100%     |
| 2026-07-11 | 100   | 0     | 0    | 0      | 0      | 100%     |
| 2026-07-11 | 100   | 0     | 0    | 0      | 0      | 100%     |
| 2026-07-11 | 100   | 0     | 0    | 0      | 0      | 100%     |
| 2026-07-11 | 100   | 0     | 0    | 0      | 0      | 100%     |

## Reguły audytu

| ID         | Opis                                                      |
| ---------- | --------------------------------------------------------- |
| **XSS001** | `innerHTML` z niezaufanymi danymi (USER_DATA)             |
| **XSS002** | `insertAdjacentHTML` z danymi zewnętrznymi                |
| **XSS003** | Inline event handler (onclick, onchange, …) — do migracji |
| **XSS004** | Template literal / konkatenacja bez `escapeHtml()`        |

## Sinks

**0 total**

## Additional sinks

None found.

## Absent

- `eval()` — **0** ✅
- `new Function()` — **0** ✅
- `document.write()` — **0** ✅
- `outerHTML` — **0** ✅

## False Positive Database

`docs/security/xss-ignore.json` — 66 known FPs

## Baseline

`docs/security/xss-baseline.json` — 0 findings (auto-generated, non-INFO only)

| File                                  | Line | Reason                                                                               |
| ------------------------------------- | ---- | ------------------------------------------------------------------------------------ |
| app.js                                | 41   | escapeHtml(editingOfferAssignedUserName)                                             |
| app.js                                | 132  | textContent zamiast innerHTML                                                        |
| admin/mlHealthDashboard.js            | 83   | literal 'Ladowanie...'                                                               |
| admin/mlHealthDashboard.js            | 88   | literal 'Nie mozna pobrac danych'                                                    |
| admin/aiDashboard.js                  | 60   | literal 'Brak dostepu do statystyk'                                                  |
| admin/aiDashboard.js                  | 66   | literal 'Brak dostepu do statystyk'                                                  |
| admin/aiDashboard.js                  | 122  | literal 'Brak wzorców'                                                               |
| admin/aiDashboard.js                  | 128  | literal 'Brak wzorców'                                                               |
| admin/aiDashboard.js                  | 133  | REAL_XSS: dnFilter z user input — naprawione escapeHtml()                            |
| admin/aiDashboard.js                  | 170  | ML pipeline: patternType=enum, patternKey=hash, description=auto, confidence numeric |
| admin/aiDashboard.js                  | 197  | literal 'ML pipeline nieaktywny'                                                     |
| admin/aiDashboard.js                  | 292  | literal 'Trenowanie...'                                                              |
| admin/aiDashboard.js                  | 355  | konkatenacja literałów, brak zmiennych                                               |
| admin/aiDashboard.js                  | 395  | literal 'Uruchamianie...'                                                            |
| admin/aiDashboard.js                  | 401  | literal 'Uruchom Learning Cycle'                                                     |
| sales/pvImportExportToolbar.js        | 15   | toolbar HTML — same literały                                                         |
| shared/clientManager.js               | 157  | literal 'Baza klientów jest pusta'                                                   |
| shared/clientManager.js               | 163  | escapeHtml(q) na frazie wyszukiwania                                                 |
| import-export/shared/conflictModal.js | 13   | window.escapeHtml(offerNumber)                                                       |
| shared/dashboard.js                   | 15   | literal 'Brak innych użytkowników'                                                   |
| shared/dashboard.js                   | 336  | escapeHtml(u.firstName                                                               |     | u.username) |
| spa/zlecenia.js                       | 164  | linia 164 = 'headers: authHeaders()', nie innerHTML                                  |
| studnie/globals.js                    | 115  | literal 'Zamówienie (krok 5)'                                                        |
| rury/offerItems.js                    | 90   | literal 'Ukryj katalog produktów'                                                    |
| rury/offerItems.js                    | 99   | literal 'Pokaż katalog produktów'                                                    |
| rury/offerItems.js                    | 126  | literal 'Brak produktów w tej kategorii'                                             |
| rury/offerItems.js                    | 1015 | literal 'Zamówienie (krok 5)'                                                        |
| rury/orderManager.js                  | 504  | literal 'Brak produktów' + colspan numeric                                           |
| rury/orderManager.js                  | 843  | escapeHtml(orderData.orderNumber/offerNumber/id) + numeryczne                        |
| rury/orderManager.js                  | 884  | escapeHtml(orderData.orderNumber/offerNumber/id)                                     |
| rury/orderManager.js                  | 1033 | literal 'Brak przejść...'                                                            |
| studnie/offerManager.js               | 1800 | escapeHtml(editingOfferAssignedUserName)                                             |
| studnie/offerManager.js               | 1896 | escapeHtml(offer.userName)                                                           |
| studnie/offerManager.js               | 2676 | escapeHtml(normalized.number                                                         |     | offer.id)   |
| studnie/offerManager.js               | 2690 | escapeHtml(editingOfferAssignedUserName)                                             |
| studnie/orderManager.js               | 1111 | literal 'Brak przejść szczelnych'                                                    |
| studnie/orderManager.js               | 2981 | literal 'Brak elementów'                                                             |
| studnie/orderManager.js               | 3145 | escapeHtml(well.name) + escapeHtml(well.dn) + fmtInt                                 |
| studnie/excelTableManager.js          | 3606 | literal 'Wklejanie...'                                                               |
| studnie/excelTableManager.js          | 5354 | rows.length — integer                                                                |
| studnie/pricelistManager.js           | 1563 | 'const dns = [1000, 1200, ...]' — brak innerHTML                                     |
| studnie/transitionRenderer.js         | 351  | literal 'Brak przejść szczelnych'                                                    |
| studnie/wellUI.js                     | 459  | literal 'Dodaj studnię aby edytować parametry'                                       |
| studnie/wellUI.js                     | 826  | ikona chevron — literal                                                              |
| studnie/wellDiagram.js                | 1004 | SVG_COLORS.dnLabel — stała z obiektu                                                 |
| studnie/wellDiagram.js                | 1032 | 6 zmiennych SVG — numeryczne lub stałe z kodu                                        |
| studnie/wellPopups.js                 | 192  | shortName z p.name (katalog admin-only edit) lub ID oferty                           |
| studnie/wellPopups.js                 | 197  | literal 'Zakończenie'                                                                |
| studnie/wellPopups.js                 | 223  | targetDn = parseInt() — zawsze numeryczne                                            |
| studnie/wellPopups.js                 | 261  | shortName regex-wycięty z p.name (katalog admin-only edit)                           |
| studnie/wellPopups.js                 | 266  | targetDn — numeryczne                                                                |
| studnie/wellPopups.js                 | 287  | literal 'Psia buda' z check                                                          |
| studnie/wellPopups.js                 | 293  | literal 'Psia buda'                                                                  |
| studnie/wellActions.js                | 106  | escapeHtml(e) na każdym configError                                                  |
| studnie/wellActions.js                | 134  | literal 'Wysokość OK'                                                                |
| studnie/wellActions.js                | 138  | diffM = toFixed(3).replace('.',',') — numeryczne                                     |
| studnie/wellActions.js                | 141  | diffM = toFixed(3).replace('.',',') — numeryczne                                     |
| studnie/wellActions.js                | 784  | literal 'Dodaj studnię aby wybrać elementy'                                          |
| studnie/wellActions.js                | 1132 | literal 'Kliknij kafelki powyżej'                                                    |
| studnie/wellTransitions.js            | 328  | inpType, inpMode, step, val — zmienne lokalne z pętli, parseFloat                    |
| studnie/wellTransitions.js            | 449  | literal 'Brak zdefiniowanych przejść'                                                |
| studnie/wellTransitions.js            | 468  | literal 'Brak przejść szczelnych'                                                    |
| studnie/wellTransitions.js            | 862  | gons = toFixed(2) — zawsze numeryczne                                                |
| studnie/wellTransitions.js            | 989  | visibleCount = filter().length + allTypes.length — integer                           |
| studnie/wellTransitions.js            | 1068 | gons = toFixed(2) — zawsze numeryczne                                                |
| versionDisplay.js                     | 33   | data.version z /api/version — VERSION + git rev-parse, 0 user input                  |

## Review instructions

1. **REAL_XSS** — fix in code, then add to `xss-ignore.json` as FIXED
2. **SUSPECT** — trace data source; add `escapeHtml()` or reclassify
3. **SAFE_STATIC** / **SAFE_NUMERIC** / **SAFE_ESCAPED** / **SERVER_GENERATED** — add to `xss-ignore.json` with classification label
4. **FALSE_POSITIVE** — add to `xss-ignore.json` with reason (wrong line, parser loss)
5. **XSS003** — migrate inline handlers to `addEventListener` / event delegation
6. Add to `docs/security/xss-ignore.json` to suppress in future runs
7. After review: update baseline (`docs/security/xss-baseline.json`) by running `npm run audit:xss`
8. Classification decisions stored in `docs/security/xss-classification.json` — commit alongside report

## CI integration (baseline-aware gates)

Porównanie z `docs/security/xss-baseline.json` — blokowane tylko NOWE problemy.

```yaml
# .github/workflows/xss-audit.yml (example)
jobs:
    xss-audit:
        steps:
            - run: npm run audit:xss
            # FAIL if any NEW CRITICAL or HIGH (not in baseline)
            - run: node -e "const m=require('fs').readFileSync('docs/security/xss-audit.md','utf8');
                  const newHigh=m.match(/\| Nowe HIGH \| (\d+) \|/);
                  const newCrit=m.match(/\| Nowe CRITICAL \| (\d+) \|/);
                  if(parseInt(newCrit?.[1]||0)>0||parseInt(newHigh?.[1]||0)>0) process.exit(1)"
```

| Gate                 | Action            | Behavior                 |
| -------------------- | ----------------- | ------------------------ |
| Nowe CRITICAL > 0    | ❌ **FAIL** build | Blocks new vulnerability |
| Nowe HIGH > 0        | ❌ **FAIL** build | Blocks new vulnerability |
| Nowe MEDIUM > 0      | ⚠️ **WARN**       | Does not block           |
| Nowe REVIEW > 0      | ⚠️ **WARN**       | Does not block           |
| Coverage drop > 10pp | ❌ **FAIL** build | Regresja narzędziowa     |
| Score drop           | ⚠️ **WARN**       | Regresja narzędziowa     |

## Classification file

`docs/security/xss-classification.json` — auto-generowany plik z klasyfikacją wszystkich 246 sinków.

Zawiera: fingerprint, severity, source, trust, confidence, rule, CWE, OWASP, decision, sprint, label, reason.

Separacja od `xss-ignore.json`:

- `xss-classification.json` = **tool output** (generator, zawsze nadpisywany)
- `xss-ignore.json` = **manualne decyzje** (commitowany, recenzowany)

## Regeneration

```bash
rg -n "innerHTML|insertAdjacentHTML|outerHTML" public/js/ --type js --glob '!xlsx.full.min.js' > docs/security/raw-sinks-utf8.txt
rg -n "onclick=|onchange=|oninput=|onmouseover=|onmouseleave=|onmouseenter=|onerror=|onload=" public/js/ --type js --glob '!xlsx.full.min.js' > docs/security/raw-handlers.txt
npm run audit:xss
```

### Tryby git

```bash
npm run audit:xss -- --changed      # tylko zmodyfikowane pliki
npm run audit:xss -- --staged       # tylko staged
npm run audit:xss -- --diff=HEAD~1  # diff względem dowolnego refa
```
