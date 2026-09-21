# Plan napraw motywów S.O.K. (dark/light + Excel) — do wykonania, nie wykonany

Status: PLAN (audyt read-only z 2026-09-21, ocena 65/10 = 6.50). Zero zmian w kodzie na tym etapie.
Zakres twardy: tylko kolorystyka, tokeny, logika, sync, struktura, testy. Bez zmian stacku, frameworków, bibliotek, zależności, geometrii modali, DOM i renderowania Excela.

## Faza 0 — decyzje (przed kodem)

- D0.1: Kontrakt Excela (S-02): wariant A (dopisać `--excel-row-*`, przepiąć konsumentów) albo B (zawęzić tekst kontraktu do listy egzekwowanej). Decyzja steruje fazą 1.
- D0.2: priorytet osobno dla (a) bootstrapu — server vs local cache przy pierwszym ładowaniu, oraz (b) po lokalnej zmianie użytkownika — intencja użytkownika vs spóźniona odpowiedź serwera. Dopuszczalny split: `server-on-bootstrap` + `user-intent-after-change` (ten drugi invariant już w S-07/S-08).
- D0.3: Klucz per-user `sok-theme_<id>` (S-05): utrzymać + naprawić head, albo usunąć suffix.
- D0.4: Print przy light ([DO WERYFIKACJI] z audytu): celowe pinowanie do dark, czy defekt — oraz czy print wchodzi do tego planu. `intentional-dark-print` = brak zmian w Fazach 1–3; `light-print-required` = osobny S-09 poza bieżącym GO (zakaz naprawiania „przy okazji").
- D0.5 — zapis decyzji: każda D0.x kończy się wpisem w formacie:

```text
D0.x — DECIDED: <wariant>
Reason: ...
Impact: ...
```

Bez kompletu D0.1–D0.5 nie startują S-02/S-05/S-07. Po Fazie 0 artefakt z kompletem decyzji jest podstawą osobnego GO na Fazę 1 (bez ponownego otwierania planu).

## Wynik Fazy 0 — DECIDED (2026-09-22, GO Faza 0)

```text
D0.1 — DECIDED: A (tokeny --excel-row-*, przepięcie konsumentów)
Reason: wiersze już dziś mają wartości różne od --excel-bg
  (dark: zebra --bg-primary #0a0e1a / --bg-secondary #111827 vs kontener
  --excel-bg → --slate-950 #0f172a; light: #f6f8fa/#ffffff vs #ffffff),
  więc to faktycznie powierzchnie excelowe, a kontrakt (:root-komentarz
  + UI_GUIDELINES.md:41 + test parzystości) już obiecuje samowystarczalność.
  Wariant B legalizowałby dryf przy każdym nowym motywie.
Impact: Faza 2 dopisuje --excel-row-even/--excel-row-odd/--excel-row-hover/
  --excel-row-active do :root + light, przepina excelTableBody.js:182-191,
  851-856; Faza 3 rozszerza BANNED o --bg-* w scope Excel.

D0.2 — DECIDED: server-on-bootstrap + user-intent-after-change
Reason: serwer jest SoT między urządzeniami (poprawia nieaktualny cache
  obcego urządzenia), a lokalna intencja nie może zostać skasowana przez
  spóźniony GET w locie (obecnie brak strażnika generacji, theme.js:164-177).
Impact: S-07 dostaje strażnik generacji/abort dla odpowiedzi; offline =
  cache zostaje (fallback bez zmian).

D0.3 — DECIDED: keep-per-user-key + wskaźnik ostatniego użytkownika
Reason: suffix izoluje współdzielone maszyny, a head nie zna userId przed
  autoryzacją — wskaźnik `sok-last-user` (zapis przy init) pozwala head
  odczytać `sok-theme_<id>` z fallbackiem do globalnego. Bez serwera,
  mechanizm wielkości S-05.
Impact: S-05 = wskaźnik + head z fallbackiem; globalny klucz zostaje.

D0.4 — DECIDED: intentional-dark-print
Reason: PRINT_TOKENS_CSS (44 tokeny, frontend ≡ backend) pinowane do
  dark-:root, DOCX ma własną paletę legacy — dokumenty to artefakty
  zewnętrzne wymagające stabilnej palety, nie widoku UI.
Impact: brak zmian w Fazach 1–3; light-print = ewentualny S-09 poza GO.
```

- Zakres GO: ten plan ubiega się o GO wyłącznie na Fazę 0. Implementacja (Fazy 1+) wymaga osobnego GO po zamrożeniu D0.1–D0.5.

## Ryzyko (z recenzji 9,2/10 — przyjęte)

| Element           | Ryzyko                                            |
| ----------------- | ------------------------------------------------- |
| Quick wins        | 🟢 niskie                                         |
| Tokenizacja       | 🟢 niskie/średnie                                 |
| Excel             | 🟡 średnie                                        |
| Bootstrap theme   | 🟡 średnie                                        |
| Sync S-07/S-08    | 🟠 najwyższe (izolowane sekwencją z Fazy 2)       |
| Testy kontraktowe | 🟢 niskie                                         |
| Scope creep       | 🟢 zabezpieczony (D0.4/D0.5, diagramy NIE RUSZAĆ) |

## Faza 1 — QUICK WINS (lokalne, bez architektury) — WYKONANE 2026-09-22 (GO Faza 1)

- S-01: `--accent-strong` — token semantycznie prawidłowy (głębszy koniec gradientu): dodany do `:root` jako `#4f46e5` (dark: `#6366f1`→`#4f46e5`); light `#4338ca` bez zmian (wygrywa specyficznością).
- S-04: dopisany light-override `color-scheme: light` na końcu `zlecenia.css` (3 selektory; globalna reguła ze `style.base.css` przegrywała specyficznością).
- K-02: USUNIĘTE `--border-muted` / `--text-disabled` (zero konsumentów; `--border-muted` był dokładnym duplikatem `--border-subtle`).
- K-04: POZOSTAWIONE oba tokeny — role semantyczne różne (`--excel-bg` kontener, `--excel-bg-alt` paski toolbar/header/footer, 4 konsumentów), równe wartości to stan dzisiejszy, nie defekt.
- K-03 (bezpieczeństwo): guard `ev.origin === window.location.origin` w odbiorze `message` (`theme.js`).
- Po fazie: najpierw bazowe testy regresji (istniejące suity zielone), potem ocena efektu Fazy 1.

## Faza 2 — STRUCTURAL (tokenizacja, sync, SRP) — BEZ GO

- S-02: wg D0.1 — nowe tokeny `--excel-row-*` w `:root` + light i przepięcie `excelTableBody.js:182-191,851-856`, albo korekta `style.base.css:249-252` i `docs/UI_GUIDELINES.md:41`.
- S-03: reguła wstrzykiwanych styli Excela (nigdy prefix `html[data-theme]`, kolory tylko tokenami) + uporządkowanie `!important` (`excelModal.js:341-361` vs `style.base.css:2179-2194`).
- S-05: wg D0.3 — head-script per-user albo usunięcie suffixu (6 plików HTML + `theme.js:30-49`).
- S-07/S-08 (największe ryzyko planu — zmiana zachowania sync, nie kolorów): invariant przed mechanizmem — ostatnia świadomie wybrana przez użytkownika wartość wygrywa z opóźnionymi odpowiedziami/starym stanem serwera. Kroki sekwencyjnie, nie naraz: (a) semantyka startowa wg D0.2, (b) jeden mechanizm (retry/backoff ALBO flaga `dirty`), (c) test rozjazdu. Zakaz łączenia retry + dirty + zmiany semantyki w jednym kroku (`theme.js:106-120,162-177`).
- K-01: bootstrap motywu niezależny od `renderHeaderUser` (`headerUser.js:24-26`).
- Diagramy: NIE RUSZAĆ (`--cmp-*` w light to osobny temat redesignu, nie naprawy kontraktu). Bez pomiaru czytelności zero zmian.
- Po fazie: `npm run test:quick`, `npm run lint:frontend`, `npm run format`.

## Faza 3 — REGRESSION SAFETY (testy)

- Rozszerzyć `excelThemeTokens`: BANNED o `--bg-*`/`--blue-rgb` w scope Excel (lub allowlista z decyzją D0.1), test kompletności konsumentów.
- Rozszerzyć `iconsCoverage` jako test kontraktu (non-blocking dla fixów dark/light): skan `shared` + `excel` + `spa` + `rury` + `kartoteka`, grupowanie per plik. Rozszerzenie nie blokuje Fazy 1–2.
- Gate dynamicznego Excela (S-03): wstrzykiwany CSS może używać tokenów `var(--...)` i właściwości strukturalnych, zakaz literalnych kolorów i alternatywnego systemu theme.
- Nowe: parytet frontend-valid === backend-valid; flip `data-theme` zmienia computed `var(--excel-bg)` bez re-renderu; storage event aplikuje w drugim kontekście; debounced PUT jako kontrakt obserwowalny: sekwencja `dark → light → dark → light` daje dokładnie 1 PUT z `value = light` (nie asercja implementacji debounce); oba pliki logo istnieją i różnią się kontenerem/typografią.
- Po fazie: pełne `npm run validate` + `npm run version:check`.

## Kolejność egzekucji

```text
0 (decyzje + zapis D0.5)
↓ baseline GREEN (obowiązkowy gate — granica diagnostyczna)
1 (quick wins, w tym K-03 security)
↓ regression GREEN (obowiązkowy gate)
2 (structural)
↓ contract tests GREEN
3 (rozszerzenie coverage)
↓ pełny validate → GO do kolejnego etapu
```

Commit per faza (`node scripts/commit.mjs`), push tylko za zgodą (🔴). Plan nie był wykonywany — czeka na GO wyłącznie na Fazę 0.
