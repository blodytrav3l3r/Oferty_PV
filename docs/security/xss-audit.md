# Audyt XSS — WITROS Oferty PV

**Data**: 2026-07-11
**Generator**: `scripts/generate-xss-audit.js`
**Ignore DB**: `docs/security/xss-ignore.json` (66 suppressed)
**Classification**: `docs/security/xss-classification.json` (246 entries)
**Zakres**: `public/js/**/*.js` — innerHTML, insertAdjacentHTML, outerHTML, onclick/onchange/oninput/onmouseenter/onmouseleave/onerror/onload handlers

---

## Scanner Score

> Wynik skanera (0–100). Odróżnij od rzeczywistego poziomu bezpieczeństwa — skaner nie analizuje przepływu danych, logiki backendu ani kontekstu biznesowego.

**100/100**

| ⚪ **INFO** | 246 |

### Escape Coverage (tooling metric)

> Udział dynamicznych sinków (konkatenacja lub template literal) zabezpieczonych `escapeHtml()`. Nie odzwierciedla rzeczywistego poziomu bezpieczeństwa — statyczne literały liczone jako nieosłonięte zaniżają wynik.

**54%** (15/28 dynamiczne innerHTML/insertAdjacentHTML z escapeHtml)

| Dynamiczne sinki | Z escapeHtml | Coverage |
| ---------------- | ------------ | -------- |
| 28               | 15           | 54%      |

### CSP Readiness (tooling metric)

**12** total inline event handlers (XSS003)
Przed usunięciem `'unsafe-inline'` z CSP wszystkie muszą być przeniesione do `addEventListener` lub event delegation.

### Security Debt

| Sprint | Total | HIGH | MEDIUM | REVIEW |
| ------ | ----- | ---- | ------ | ------ |
| -      | 180   | 0    | 0      | 0      |
| S2     | 66    | 0    | 0      | 0      |

### Scanner Gate

| Kryterium      | Wymóg | Obecnie | Status |
| -------------- | ----- | ------- | ------ |
| CRITICAL = 0   | 0     | 0       | ✅     |
| HIGH = 0       | 0     | 0       | ✅     |
| MEDIUM ≤ 10    | ≤ 10  | 0       | ✅     |
| REVIEW = 0     | 0     | 0       | ✅     |
| Coverage ≥ 95% | ≥ 95% | 54      | ❌     |

### Delta (vs poprzednie uruchomienie)

| Metryka  | Poprzednio | Obecnie | Zmiana |
| -------- | ---------- | ------- | ------ |
| Score    | 100        | 100     | ➡️ 0   |
| CRITICAL | 0          | 0       | ➡️ 0   |
| HIGH     | 0          | 0       | ➡️ 0   |
| MEDIUM   | 0          | 0       | ➡️ 0   |
| REVIEW   | 0          | 0       | ➡️ 0   |
| Coverage | 54%        | 54%     | ➡️ 0%  |

### Trend

| Data       | Score | Total | HIGH | MEDIUM | REVIEW | Coverage |
| ---------- | ----- | ----- | ---- | ------ | ------ | -------- |
| 2026-07-11 | 98    | 246   | 0    | 8      | 56     | 6%       |
| 2026-07-11 | 98    | 246   | 0    | 8      | 56     | 54%      |
| 2026-07-11 | 98    | 246   | 0    | 8      | 56     | 54%      |
| 2026-07-11 | 98    | 246   | 0    | 8      | 56     | 54%      |
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

## Reguły audytu

| ID         | Opis                                                      |
| ---------- | --------------------------------------------------------- |
| **XSS001** | `innerHTML` z niezaufanymi danymi (USER_DATA)             |
| **XSS002** | `insertAdjacentHTML` z danymi zewnętrznymi                |
| **XSS003** | Inline event handler (onclick, onchange, …) — do migracji |
| **XSS004** | Template literal / konkatenacja bez `escapeHtml()`        |

## Sinks

**246 total** | ⚪ INFO 246

### Info (SAFE)

**Info (SAFE)** — 246 pozycji (66 ignored)

| ID      | Reguła | Plik                                  | Linia | Sink               | Źródło    | Trust        | Pewność | CWE | OWASP | Decyzja | Sprint |
| ------- | ------ | ------------------------------------- | ----- | ------------------ | --------- | ------------ | ------- | --- | ----- | ------- | ------ |
| XSS-001 | —      | appStudnie.js                         | 44    | innerHTML          | DATABASE  | semi-trusted | high    | —   | —     | leave   | -      |
| XSS-002 | —      | app.js                                | 41    | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-003 | —      | app.js                                | 73    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-004 | —      | app.js                                | 132   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-005 | —      | versionDisplay.js                     | 33    | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-006 | —      | versionDisplay.js                     | 35    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-007 | —      | versionDisplay.js                     | 40    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-008 | —      | admin\mlHealthDashboard.js            | 83    | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-009 | —      | admin\mlHealthDashboard.js            | 88    | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-010 | —      | admin\mlHealthDashboard.js            | 154   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-011 | —      | admin\aiDashboard.js                  | 60    | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-012 | —      | admin\aiDashboard.js                  | 66    | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-013 | —      | admin\aiDashboard.js                  | 106   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-014 | —      | admin\aiDashboard.js                  | 122   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-015 | —      | admin\aiDashboard.js                  | 128   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-016 | —      | admin\aiDashboard.js                  | 133   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-017 | —      | admin\aiDashboard.js                  | 170   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-018 | —      | admin\aiDashboard.js                  | 190   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-019 | —      | admin\aiDashboard.js                  | 197   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-020 | —      | admin\aiDashboard.js                  | 278   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-021 | —      | admin\aiDashboard.js                  | 292   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-022 | —      | admin\aiDashboard.js                  | 298   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-023 | —      | admin\aiDashboard.js                  | 311   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-024 | —      | admin\aiDashboard.js                  | 330   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-025 | —      | admin\aiDashboard.js                  | 343   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-026 | —      | admin\aiDashboard.js                  | 355   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-027 | —      | admin\aiDashboard.js                  | 395   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-028 | —      | admin\aiDashboard.js                  | 401   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-029 | —      | admin\aiDashboard.js                  | 419   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-030 | —      | sales\kartotekaInit.js                | 25    | innerHTML          | DATABASE  | semi-trusted | high    | —   | —     | leave   | -      |
| XSS-031 | —      | sales\kartotekaInit.js                | 88    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-032 | —      | sales\pvImportExportToolbar.js        | 15    | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-033 | —      | sales\pvImportExportToolbar.js        | 210   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-034 | —      | sales\pvImportExportToolbar.js        | 221   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-035 | —      | sales\pvImportExportToolbar.js        | 226   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-036 | —      | sales\pvSalesUi.js                    | 210   | innerHTML          | DATABASE  | semi-trusted | high    | —   | —     | leave   | -      |
| XSS-037 | —      | sales\pvSalesUi.js                    | 314   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-038 | —      | sales\pvSalesUi.js                    | 325   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-039 | —      | sales\pvSalesUi.js                    | 422   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-040 | —      | sales\pvSalesUi.js                    | 426   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-041 | —      | sales\pvSalesUi.js                    | 1561  | insertAdjacentHTML | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-042 | —      | sales\pvSalesUi.js                    | 1565  | insertAdjacentHTML | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-043 | —      | studnie\excelTableManager.js          | 1611  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-044 | —      | studnie\excelTableManager.js          | 1912  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-045 | —      | studnie\excelTableManager.js          | 2736  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-046 | —      | studnie\excelTableManager.js          | 3606  | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-047 | —      | studnie\excelTableManager.js          | 5093  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-048 | —      | studnie\excelTableManager.js          | 5229  | insertAdjacentHTML | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-049 | —      | studnie\excelTableManager.js          | 5330  | insertAdjacentHTML | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-050 | —      | studnie\excelTableManager.js          | 5354  | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-051 | —      | shared\clientManager.js               | 157   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-052 | —      | shared\clientManager.js               | 163   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-053 | —      | shared\clientManager.js               | 174   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-054 | —      | shared\clientManager.js               | 215   | innerHTML          | DATABASE  | semi-trusted | high    | —   | —     | leave   | -      |
| XSS-055 | —      | shared\clientManager.js               | 245   | innerHTML          | DATABASE  | semi-trusted | high    | —   | —     | leave   | -      |
| XSS-056 | —      | shared\clientManager.js               | 256   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-057 | —      | import-export\shared\conflictModal.js | 13    | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-058 | —      | shared\dashboard.js                   | 15    | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-059 | —      | shared\dashboard.js                   | 18    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-060 | —      | shared\dashboard.js                   | 67    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-061 | —      | shared\dashboard.js                   | 74    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-062 | —      | shared\dashboard.js                   | 234   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-063 | —      | shared\dashboard.js                   | 241   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-064 | —      | shared\dashboard.js                   | 336   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-065 | —      | shared\dashboard.js                   | 342   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-066 | —      | shared\dashboard.js                   | 377   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-067 | —      | spa\zlecenia.js                       | 88    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-068 | —      | spa\zlecenia.js                       | 164   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-069 | —      | spa\zlecenia.js                       | 186   | innerHTML          | DATABASE  | semi-trusted | high    | —   | —     | leave   | -      |
| XSS-070 | —      | spa\zlecenia.js                       | 219   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-071 | —      | spa\zlecenia.js                       | 328   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-072 | —      | spa\zlecenia.js                       | 409   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-073 | —      | shared\iconsSlim.js                   | 12    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-074 | —      | shared\iconsSlim.js                   | 426   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-075 | —      | rury\offerCrud.js                     | 135   | innerHTML          | DATABASE  | semi-trusted | high    | —   | —     | leave   | -      |
| XSS-076 | —      | rury\offerCrud.js                     | 277   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-077 | —      | rury\offerCrud.js                     | 286   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-078 | —      | rury\offerCrud.js                     | 292   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-079 | —      | rury\offerCrud.js                     | 310   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-080 | —      | rury\offerCrud.js                     | 424   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-081 | —      | rury\offerCrud.js                     | 517   | innerHTML          | DATABASE  | semi-trusted | high    | —   | —     | leave   | -      |
| XSS-082 | —      | rury\offerCrud.js                     | 527   | innerHTML          | DATABASE  | semi-trusted | high    | —   | —     | leave   | -      |
| XSS-083 | —      | rury\offerCrud.js                     | 529   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-084 | —      | rury\offerCrud.js                     | 536   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-085 | —      | spa\router.js                         | 69    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-086 | —      | spa\router.js                         | 102   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-087 | —      | spa\router.js                         | 114   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-088 | —      | spa\router.js                         | 138   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-089 | —      | rury\offerExports.js                  | 345   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-090 | —      | studnie\globals.js                    | 75    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-091 | —      | studnie\globals.js                    | 115   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-092 | —      | studnie\globals.js                    | 121   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-093 | —      | studnie\globals.js                    | 125   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-094 | —      | rury\offerItems.js                    | 35    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-095 | —      | rury\offerItems.js                    | 90    | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-096 | —      | rury\offerItems.js                    | 99    | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-097 | —      | rury\offerItems.js                    | 108   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-098 | —      | rury\offerItems.js                    | 126   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-099 | —      | rury\offerItems.js                    | 167   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-100 | —      | rury\offerItems.js                    | 550   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-101 | —      | rury\offerItems.js                    | 616   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-102 | —      | rury\offerItems.js                    | 739   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-103 | —      | rury\offerItems.js                    | 1015  | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-104 | —      | rury\offerItems.js                    | 1021  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-105 | —      | rury\offerItems.js                    | 1025  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-106 | —      | shared\printModal.js                  | 223   | insertAdjacentHTML | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-107 | —      | rury\offerSummaryTab.js               | 58    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-108 | —      | rury\offerSummaryTab.js               | 297   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-109 | —      | shared\ui.js                          | 10    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-110 | —      | shared\ui.js                          | 151   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-111 | —      | shared\ui.js                          | 570   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-112 | —      | studnie\offerManager.js               | 38    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-113 | —      | studnie\offerManager.js               | 52    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-114 | —      | studnie\offerManager.js               | 65    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-115 | —      | studnie\offerManager.js               | 1520  | innerHTML          | DATABASE  | semi-trusted | high    | —   | —     | leave   | -      |
| XSS-116 | —      | studnie\offerManager.js               | 1524  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-117 | —      | studnie\offerManager.js               | 1531  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-118 | —      | studnie\offerManager.js               | 1535  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-119 | —      | studnie\offerManager.js               | 1658  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-120 | —      | studnie\offerManager.js               | 1800  | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-121 | —      | studnie\offerManager.js               | 1896  | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-122 | —      | studnie\offerManager.js               | 1988  | innerHTML          | DATABASE  | semi-trusted | high    | —   | —     | leave   | -      |
| XSS-123 | —      | studnie\offerManager.js               | 2313  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-124 | —      | studnie\offerManager.js               | 2315  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-125 | —      | studnie\offerManager.js               | 2323  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-126 | —      | studnie\offerManager.js               | 2341  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-127 | —      | studnie\offerManager.js               | 2347  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-128 | —      | studnie\offerManager.js               | 2676  | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-129 | —      | studnie\offerManager.js               | 2681  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-130 | —      | studnie\offerManager.js               | 2690  | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-131 | —      | studnie\offerManager.js               | 2693  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-132 | —      | studnie\offerManager.js               | 3071  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-133 | —      | studnie\offerManager.js               | 3182  | insertAdjacentHTML | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-134 | —      | studnie\offerManager.js               | 3186  | insertAdjacentHTML | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-135 | —      | studnie\offerManager.js               | 3448  | innerHTML          | DATABASE  | semi-trusted | high    | —   | —     | leave   | -      |
| XSS-136 | —      | studnie\offerManager.js               | 3455  | innerHTML          | DATABASE  | semi-trusted | high    | —   | —     | leave   | -      |
| XSS-137 | —      | studnie\offerManager.js               | 3677  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-138 | —      | studnie\offerManager.js               | 3783  | innerHTML          | DATABASE  | semi-trusted | high    | —   | —     | leave   | -      |
| XSS-139 | —      | rury\orderManager.js                  | 500   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-140 | —      | rury\orderManager.js                  | 504   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-141 | —      | rury\orderManager.js                  | 510   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-142 | —      | rury\orderManager.js                  | 536   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-143 | —      | rury\orderManager.js                  | 576   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-144 | —      | rury\orderManager.js                  | 843   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-145 | —      | rury\orderManager.js                  | 884   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-146 | —      | rury\orderManager.js                  | 923   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-147 | —      | rury\orderManager.js                  | 1033  | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-148 | —      | rury\orderManager.js                  | 1083  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-149 | —      | rury\pricelistUi.js                   | 13    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-150 | —      | rury\pricelistUi.js                   | 86    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-151 | —      | studnie\orderManager.js               | 690   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-152 | —      | studnie\orderManager.js               | 710   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-153 | —      | studnie\orderManager.js               | 1111  | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-154 | —      | studnie\orderManager.js               | 1141  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-155 | —      | studnie\orderManager.js               | 1226  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-156 | —      | studnie\orderManager.js               | 2205  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-157 | —      | studnie\orderManager.js               | 2358  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-158 | —      | studnie\orderManager.js               | 2666  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-159 | —      | studnie\orderManager.js               | 2948  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-160 | —      | studnie\orderManager.js               | 2981  | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-161 | —      | studnie\orderManager.js               | 3039  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-162 | —      | studnie\orderManager.js               | 3145  | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-163 | —      | studnie\orderManager.js               | 3499  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-164 | —      | studnie\orderManager.js               | 3504  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-165 | —      | studnie\orderManager.js               | 4722  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-166 | —      | studnie\orderManager.js               | 4849  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-167 | —      | studnie\orderManager.js               | 4863  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-168 | —      | studnie\orderManager.js               | 5050  | insertAdjacentHTML | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-169 | —      | studnie\pricelistManager.js           | 21    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-170 | —      | studnie\pricelistManager.js           | 296   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-171 | —      | studnie\pricelistManager.js           | 654   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-172 | —      | studnie\pricelistManager.js           | 1563  | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-173 | —      | studnie\pricelistManager.js           | 1658  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-174 | —      | rury\transport.js                     | 168   | innerHTML          | NUMERIC   | trusted      | high    | —   | —     | leave   | -      |
| XSS-175 | —      | rury\transport.js                     | 189   | innerHTML          | NUMERIC   | trusted      | high    | —   | —     | leave   | -      |
| XSS-176 | —      | rury\transport.js                     | 319   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-177 | —      | rury\transport.js                     | 394   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-178 | —      | rury\transport.js                     | 648   | innerHTML          | NUMERIC   | trusted      | high    | —   | —     | leave   | -      |
| XSS-179 | —      | rury\transport.js                     | 692   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-180 | —      | rury\wizard.js                        | 54    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-181 | —      | rury\wizard.js                        | 69    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-182 | —      | rury\wizard.js                        | 78    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-183 | —      | rury\wizard.js                        | 97    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-184 | —      | studnie\transitionRenderer.js         | 351   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-185 | —      | studnie\transitionRenderer.js         | 356   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-186 | —      | studnie\wellUI.js                     | 60    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-187 | —      | studnie\wellUI.js                     | 93    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-188 | —      | studnie\wellUI.js                     | 459   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-189 | —      | studnie\wellUI.js                     | 548   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-190 | —      | studnie\wellUI.js                     | 558   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-191 | —      | studnie\wellUI.js                     | 567   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-192 | —      | studnie\wellUI.js                     | 574   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-193 | —      | studnie\wellUI.js                     | 592   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-194 | —      | studnie\wellUI.js                     | 781   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-195 | —      | studnie\wellUI.js                     | 826   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-196 | —      | studnie\wellUI.js                     | 1035  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-197 | —      | studnie\wellDiagram.js                | 993   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-198 | —      | studnie\wellDiagram.js                | 1004  | innerHTML          | USER_DATA | untrusted    | medium  | —   | —     | fix     | S2     |
| XSS-199 | —      | studnie\wellDiagram.js                | 1032  | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-200 | —      | studnie\wellPopups.js                 | 192   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-201 | —      | studnie\wellPopups.js                 | 197   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-202 | —      | studnie\wellPopups.js                 | 223   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-203 | —      | studnie\wellPopups.js                 | 230   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-204 | —      | studnie\wellPopups.js                 | 261   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-205 | —      | studnie\wellPopups.js                 | 266   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-206 | —      | studnie\wellPopups.js                 | 287   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-207 | —      | studnie\wellPopups.js                 | 293   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-208 | —      | studnie\wellPopups.js                 | 846   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-209 | —      | studnie\wellPopups.js                 | 901   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-210 | —      | studnie\wellPopups.js                 | 1482  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-211 | —      | studnie\wellPopups.js                 | 1579  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-212 | —      | studnie\wellPopups.js                 | 1636  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-213 | —      | studnie\wellPopups.js                 | 1657  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-214 | —      | studnie\wellPopups.js                 | 1707  | innerHTML          | DATABASE  | semi-trusted | high    | —   | —     | leave   | -      |
| XSS-215 | —      | studnie\wellPopups.js                 | 1819  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-216 | —      | studnie\wellActions.js                | 94    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-217 | —      | studnie\wellActions.js                | 96    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-218 | —      | studnie\wellActions.js                | 106   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-219 | —      | studnie\wellActions.js                | 134   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-220 | —      | studnie\wellActions.js                | 138   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-221 | —      | studnie\wellActions.js                | 141   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-222 | —      | studnie\wellActions.js                | 145   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-223 | —      | studnie\wellActions.js                | 784   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-224 | —      | studnie\wellActions.js                | 1095  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-225 | —      | studnie\wellActions.js                | 1132  | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-226 | —      | studnie\wellActions.js                | 1532  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-227 | —      | studnie\wellActions.js                | 1772  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-228 | —      | studnie\wellActions.js                | 1775  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-229 | —      | studnie\wellTransitions.js            | 98    | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-230 | —      | studnie\wellTransitions.js            | 131   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-231 | —      | studnie\wellTransitions.js            | 328   | innerHTML          | USER_DATA | untrusted    | medium  | —   | —     | fix     | S2     |
| XSS-232 | —      | studnie\wellTransitions.js            | 449   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-233 | —      | studnie\wellTransitions.js            | 468   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-234 | —      | studnie\wellTransitions.js            | 715   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-235 | —      | studnie\wellTransitions.js            | 862   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-236 | —      | studnie\wellTransitions.js            | 873   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-237 | —      | studnie\wellTransitions.js            | 917   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-238 | —      | studnie\wellTransitions.js            | 989   | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-239 | —      | studnie\wellTransitions.js            | 1068  | innerHTML          | UNKNOWN   | unknown      | low     | —   | —     | review  | S2     |
| XSS-240 | —      | studnie\wellTransitions.js            | 1149  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-241 | —      | studnie\wellTransitions.js            | 1219  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-242 | —      | studnie\wellTransitions.js            | 1299  | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-243 | —      | studnie\uiHelpers.js                  | 288   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-244 | —      | studnie\uiHelpers.js                  | 331   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-245 | —      | studnie\uiHelpers.js                  | 336   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |
| XSS-246 | —      | studnie\uiHelpers.js                  | 349   | innerHTML          | STATIC    | trusted      | high    | —   | —     | leave   | -      |

## Inline event handlers (XSS003)

**12** total (inline HTML `onclick="..."` + DOM property `el.onclick = fn`)

| Type      | Count |
| --------- | ----- |
| `unknown` | 12    |

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
