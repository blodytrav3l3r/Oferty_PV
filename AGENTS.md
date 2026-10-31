# S.O.K. — System Ofert i Kalkulacji — Instrukcje dla Agenta AI (v2)

Uniwersalny zestaw reguł dla każdego modelu AI (OpenCode, DeepSeek, Claude, Cursor itp.).
Szczegóły domenowe w `docs/agents/` (routing poniżej) — ten plik to mapa i twarde bramy.

## Obowiązkowe bramy (przed każdym commitem/pushem)

- `npm run version:check` (spójność wersji we WSZYSTKICH źródłach; rozjazd = blokada, bez wyjątków — także przy samych docsach).
- `npm run validate` (typecheck BE+FE + lint BE+FE + appname + licenses + collisions + test:quick + prices:verify).
- `npm run format` (Prettier; respektuj `.prettierrc`, nie nadpisuj ustawień).
- Commity wyłącznie przez `node scripts/commit.mjs "typ(scope): opis"` (polskie znaki, reguły commitlint).
- Kodowanie UTF-8 bez BOM (`.bat` ASCII-only); przy ERROR: `npm run encoding:fix`.
- Inwarianty: `docs/SYSTEM_INVARIANTS.md` (I-001–I-013) — przeczytaj przed zmianą logiki biznesowej; zmiana inwariantu tylko za jawną decyzją.
- Ceny: każda kwota PLN przechodzi przez `roundMoney` (2 miejsca, half-up) — FE `public/js/shared/formatters.js`, BE `src/utils/money.ts`; reguły i checklist: `docs/MONEY_ROUNDING.md`.

## Source of Truth Protocol (nadrzędne, EVIDENCE-FIRST)

Repozytorium jest jedynym źródłem prawdy o stanie projektu. Poprzedni audyt, plan,
komentarz, pamięć agenta i założenie użytkownika to hipoteza startowa, nie fakt.

- Zasada: `CLAIM → EVIDENCE → VERIFY → ACT`. Nigdy: `CLAIM → ASSUME → ACT`.
- Łańcuch: `NIE WIEM → SPRAWDZAM → MAM DOWÓD → DZIAŁAM → ZMIENIŁEM → TESTUJĘ → DIFF → COMMIT`.
- Twierdzenie o stanie kodu potwierdzaj w: working tree, kodzie, konfiguracji, testach,
  historii Git, wynikach wykonywalnych komend.

Hierarchia źródeł prawdy (przy konflikcie wyższe wygrywa): kod i konfiguracja → testy
i ich wyniki → Git HEAD → artefakty build/CI → dokumentacja → ADR i inwarianty →
plany/TODO → raporty audytów → wcześniejsze rozmowy → założenia agenta.

Klasyfikacja twierdzeń: `FACT` (kod/test/konfig/runtime) / `INFERENCE` (wniosek z faktów) /
`HYPOTHESIS` (do weryfikacji) / `UNVERIFIED` (źródło zewnętrzne, niepotwierdzone).
`HYPOTHESIS` i `UNVERIFIED` nigdy jako `FACT`.

Twarde reguły dowodowe, Evidence Ledger i szablon checkpointu: `docs/agents/evidence.md`.

## Mapa architektury

- **Backend**: TypeScript + Express + Prisma + SQLite (`server.ts`, `src/`, `scripts/`, `tests/`). Warstwy: routes → validators → services → Prisma. Monolit celowy.
- **Frontend**: Vanilla JS SPA (`app.html` + iframe modułów `studnie.html`/`rury.html`), kod w `public/js/` (nie kompilowany przez `tsc`, sprawdzany przez ESLint + `typecheck:frontend`).
- **Decyzje (ADR)**: `docs/adr/` — ADR-001 SQLite, ADR-002 Vanilla SPA, ADR-004 Express+Prisma, ADR-005 Express jedynym serwerem, ADR-006 HTTPS/reverse proxy, ADR-007 cenniki, ADR-008 modularyzacja frontendu, ADR-009 mapa produktów studni, ADR-014 iframe boundary, ADR-016 SLA per zespół (pełna lista: `docs/adr/`).
- **Legacy surface (nie powiększaj)**: 260 plików JS, 1278 przypisań `window.X =`, 0 inline `onclick` w HTML (CSP-E), 21 programistycznych `.onclick =` w `public/js` (stan 2026-10-25). Zasada: NEW globals/inline/inline-styles = 0; nowy kod ESM + `addEventListener`. Excel to protected zone.
- **Zakazane kierunki** (decyzje, nie zaległości): React, PostgreSQL, mikroserwisy, Redis, BullMQ/Kafka, Pact, OpenTelemetry, pełna normalizacja JSON, masowe przepisywanie legacy.

## Filozofia pracy (skrót)

- Read-first: grep/read przed pisaniem; nie reimplementuj helperów z sąsiedztwa (najpierw SSoT: `getSortedRuryItems`, `ownership.ts`, `versionWrite.ts`, `snapshots.ts`).
- Niejasność → najbardziej logiczny default zgodny z architekturą + krótka notka; pytania tylko gdy ryzyko poważnego błędu **lub akcja z listy 🔴 w `docs/AUTONOMY_CONTRACT.md`** (push, migracje/seed, prod DB, progi ML, destrukcja w gicie).
- Tradeoffy jawnie: widzisz prostsze rozwiązanie — powiedz przed kodowaniem, nie po; nie wybieraj interpretacji po cichu.
- Cudzy dead code i niepowiązane poprawki: zgłoś, nie usuwaj; każda zmieniona linia musi wynikać z zadania.
- Zadanie wieloetapowe → krótki plan z `verify:` na krok.
- Błąd → rzeczowo i od razu fix; bez placeholderów (`// reszta bez zmian` zakazane); po edycji `typecheck` (BE) / `node -c` (JS).
- DRY, SRP, KISS; funkcje ~100–150 linii, max 3 poziomy zagnieżdżeń; nazwy: funkcje czasownik+rzeczownik, boolean `is/has/can`; immutability (`[...t].sort(...)`); brak silent fail; Zod na wejściu.
- Multi-model: po przejęciu sesji podejmij pracę od ostatniego stabilnego stanu (`docs/plans/`, git log); mniejsze modele: zero placeholderów + częstszy `typecheck`; większe: kontrola SRP/DRY/ADR + refaktor po poprzedniku.

## Polityka kontekstu (jakość przede wszystkim, koszt przy okazji)

- Rozpoznanie w **>2 plikach** → subagent `cavecrew-investigator` (zwraca tabelę `file:line`); nie wciągaj treści plików do głównego kontekstu. `Explore` zwraca prozę — używaj go tylko, gdy potrzebujesz narracji.
- `read` pliku **>300 linii** → zawsze z `offset`/`limit`; całość tylko gdy edytujesz większość pliku.
- Szukanie konkretnego fragmentu → `grep` z kontekstem (`-C 3`), nie `read` całego pliku.
- Pytania „gdzie jest X"/architektura → `graphify` (MCP), nie grep po całym repo.
- Powrót do zadania z historii → `claude_mem_search` **przed** czytaniem plików.
- `ocr_review`: najpierw `preview: true`; potem `exclude` na `graphify-out/`, `dist/`, `node_modules/`, snapshoty; wznowienie przez `resume`.
- Jedno zadanie = jedna sesja; `session_rename` przy zmianie wątku.
- Bramy egzekwuje kod (pre-push/pre-commit), nie proza — nie powtarzaj ich treści w promptcie ani w nowych plikach `instructions`.

## Routing domenowy (szczegóły)

- Frontend + UI/UX + Excel + Rury/Studnie: `docs/agents/frontend.md` (+ SSoT wizualny `docs/UI_GUIDELINES.md`).
- Backend + konwencje kodu: `docs/agents/backend.md`.
- Baza/migracje/backup/cenniki: `docs/agents/database.md`.
- Bezpieczeństwo (XSS/CSRF/auth/CSP): `docs/agents/security.md`.
- Testy + bramy jakości: `docs/agents/testing.md`.
- Commity/wersje/release/plany: `docs/agents/release.md`.
- Komendy + kodowanie: `docs/agents/commands.md`.
- Evidence-first (pełny protokół, audyty P0/P1): `docs/agents/evidence.md`.
- Baza znanych błędów #1–#63: tabela skrótowa w historii + pełnia `docs/errors-known.md` (SSoT numeracji).
- Przed zmianą w Excelu, XSS/CSRF/CSP, Prisma/migracjach, PDF lub kodowaniu: `grep` w `docs/errors-known.md` po temacie — nie odkrywaj znanego błędu drugi raz.

### Bezpieczeństwo Git — Git Safety (obowiązkowe, SSoT `docs/development/GIT_SAFETY.md`)

- Zakaz destrukcyjnego Gita do naprawy build/test/lint/typecheck (`FAIL → diagnose → fix → rerun`).
- Zakaz odrzucania worktree bez wyraźnego żądania. Przed destrukcją Tier A (`checkout --`, `restore`, `reset --hard`, `clean -f*`): snapshot → verify → `--force`; `verify FAIL` → STOP.
- Bez omijania safety layer (`spawnSync('git')` bez shella omija wrapper na Windows).
- Snapshoty L1: `npm run git:safety:list|inspect|verify|restore --force`.

## Plany

Wszystkie plany/taski (`.md`) w `docs/plans/` (wyjątek: `.hermes/`, `.opencode/`). Zakończone: `git mv` do `docs/plans/archive/`.

## Subagenty i konfiguracja OpenCode V2

Runtime: **OpenCode V2** (`opencode-cli.exe` z aplikacji desktop, obecnie 2.1.4). Globalny npm `opencode` 1.x **nie jest wspierany** — odrzuca projektowy config (V2 `permissions`). Szczegóły, lokalizacje plików i lista aktywnych pluginów: `docs/development/OPENCODE.md`.

Model subagentów w `.opencode/opencode.json` (`agents.<id>.model`). Zmiana configu przeładowuje się automatycznie — restart nie jest potrzebny. Bez ustawienia subagent dziedziczy model primary.

## graphify

Knowledge graph w `graphify-out/`. Na `/graphify`: `query` → `path` → `explain`. Po zmianie kodu: `graphify update .`.

- `query_graph` z `token_budget: 1000–1200` i `depth: 2`; szerszy budżet tylko gdy pytanie obejmuje cały moduł.
- **Zakaz czytania `GRAPH_REPORT.md`** (225 KB ≈ 56k tokenów) w głównym wątku — to artefakt do przeglądu poza agentem; do architektury wystarczy `query_graph` lub `god_nodes`.
- `graph.json` (11,9 MB) jest generowany i gitignored — nigdy nie czytaj go bezpośrednio.

## Kontrakt autonomii agenta (SSoT `docs/AUTONOMY_CONTRACT.md` z 2026-09-21)

| Tier         | Zakres                                                                                                    | Tryb                                  |
| ------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 🟢 Autonomia | read-only audyty, testy, docs, małe fixy z zielonym `test:quick`, re-run pomiarów, commity docs/test-only | działanie + raport ex post, bez pusha |
| 🟡 Batch GO  | implementacje P1/P2, nowe plany, commity kodu                                                             | jedno GO na paczkę                    |
| 🔴 Osobne GO | push, restart/migracje/seed, progi ML, prod DB, operacje destrukcyjne w gicie                             | zawsze jawna zgoda                    |

Twarde invarianty: GO na plan ≠ GO na kod; brak operacji na live DB poza drillem; progi ML tylko na danych; brak fallbacku do domyślnego `DATABASE_URL`; STOP przerywa paczkę natychmiast.
