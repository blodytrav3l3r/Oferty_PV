# S.O.K. — System Ofert i Kalkulacji — Instrukcje dla Agenta AI (v2)

Uniwersalny zestaw reguł dla każdego modelu AI (OpenCode, DeepSeek, Claude, Cursor itp.).
Szczegóły domenowe w `docs/agents/` (routing poniżej) — ten plik to mapa i twarde bramy.

## Obowiązkowe bramy (przed każdym commitem/pushem)

- `npm run version:check` (spójność wersji we WSZYSTKICH źródłach; rozjazd = blokada, bez wyjątków — także przy samych docsach).
- `npm run validate` (typecheck BE+FE + lint BE+FE + appname + licenses + collisions + test:quick + prices:verify).
- `npm run format` (Prettier; respektuj `.prettierrc`, nie nadpisuj ustawień).
- Commity wyłącznie przez `node scripts/commit.mjs "typ(scope): opis"` (polskie znaki, reguły commitlint).
- Kodowanie UTF-8 bez BOM (`.bat` ASCII-only); przy ERROR: `npm run encoding:fix`.
- Inwarianty: `docs/SYSTEM_INVARIANTS.md` (I-001–I-012) — przeczytaj przed zmianą logiki biznesowej; zmiana inwariantu tylko za jawną decyzją.

## Mapa architektury

- **Backend**: TypeScript + Express + Prisma + SQLite (`server.ts`, `src/`, `scripts/`, `tests/`). Warstwy: routes → validators → services → Prisma. Monolit celowy.
- **Frontend**: Vanilla JS SPA (`app.html` + iframe modułów `studnie.html`/`rury.html`), kod w `public/js/` (nie kompilowany przez `tsc`, sprawdzany przez ESLint + `typecheck:frontend`).
- **Decyzje (ADR)**: `docs/adr/` — ADR-001 SQLite, ADR-002 Vanilla SPA, ADR-004 Express+Prisma, ADR-005 Express jedynym serwerem, ADR-006 HTTPS/reverse proxy, ADR-007 cenniki, ADR-008 modularyzacja frontendu, ADR-009 mapa produktów studni.
- **Legacy surface (nie powiększaj)**: ~245 plików JS, ~1434 `window.*`, ~290 `onclick`. Zasada: NEW globals/inline/inline-styles = 0; nowy kod ESM + `addEventListener`. Excel to protected zone.
- **Zakazane kierunki** (decyzje, nie zaległości): React, PostgreSQL, mikroserwisy, Redis, BullMQ/Kafka, Pact, OpenTelemetry, pełna normalizacja JSON, masowe przepisywanie legacy.

## Filozofia pracy (skrót)

- Read-first: grep/read przed pisaniem; nie reimplementuj helperów z sąsiedztwa (najpierw SSoT: `getSortedRuryItems`, `ownership.ts`, `versionWrite.ts`, `snapshots.ts`).
- Niejasność → najbardziej logiczny default zgodny z architekturą + krótka notka; pytania tylko gdy ryzyko poważnego błędu.
- Błąd → rzeczowo i od razu fix; bez placeholderów (`// reszta bez zmian` zakazane); po edycji `typecheck` (BE) / `node -c` (JS).
- DRY, SRP, KISS; funkcje ~100–150 linii, max 3 poziomy zagnieżdżeń; nazwy: funkcje czasownik+rzeczownik, boolean `is/has/can`; immutability (`[...t].sort(...)`); brak silent fail; Zod na wejściu.
- Multi-model: po przejęciu sesji podejmij pracę od ostatniego stabilnego stanu (`docs/plans/`, git log); mniejsze modele: zero placeholderów + częstszy `typecheck`; większe: kontrola SRP/DRY/ADR + refaktor po poprzedniku.

## Routing domenowy (szczegóły)

- Frontend + UI/UX + Excel + Rury/Studnie: `docs/agents/frontend.md` (+ SSoT wizualny `docs/UI_GUIDELINES.md`).
- Backend + konwencje kodu: `docs/agents/backend.md`.
- Baza/migracje/backup/cenniki: `docs/agents/database.md`.
- Bezpieczeństwo (XSS/CSRF/auth/CSP): `docs/agents/security.md`.
- Testy + bramy jakości: `docs/agents/testing.md`.
- Commity/wersje/release/plany: `docs/agents/release.md`.
- Komendy + kodowanie: `docs/agents/commands.md`.
- Baza znanych błędów #1–#47: tabela skrótowa w historii + pełnia `docs/errors-known.md` (SSoT numeracji).

### Bezpieczeństwo Git — Git Safety (obowiązkowe, SSoT `docs/development/GIT_SAFETY.md`)

- Zakaz destrukcyjnego Gita do naprawy build/test/lint/typecheck (`FAIL → diagnose → fix → rerun`).
- Zakaz odrzucania worktree bez wyraźnego żądania. Przed destrukcją Tier A (`checkout --`, `restore`, `reset --hard`, `clean -f*`): snapshot → verify → `--force`; `verify FAIL` → STOP.
- Bez omijania safety layer (`spawnSync('git')` bez shella omija wrapper na Windows).
- Snapshoty L1: `npm run git:safety:list|inspect|verify|restore --force`.

## Plany

Wszystkie plany/taski (`.md`) w `docs/plans/` (wyjątek: `.hermes/`, `.opencode/`). Zakończone: `git mv` do `docs/plans/archive/`.

## Subagenty OpenCode — model w `task` tool

Model subagentów w `.opencode/opencode.json` (`agent.{type}.model`); wymaga restartu opencode. Bez ustawienia subagent dziedziczy model primary. Workaround: `task(subagent_type: "general", prompt: "Jesteś architektem...")`.

## graphify

Knowledge graph w `graphify-out/`. Na `/graphify`: `query` → `path` → `explain`; `GRAPH_REPORT.md` tylko do szerokiego przeglądu. Po zmianie kodu: `graphify update .`.

## Kontrakt autonomii agenta (SSoT `docs/AUTONOMY_CONTRACT.md` z 2026-09-21)

| Tier         | Zakres                                                                                                    | Tryb                                  |
| ------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 🟢 Autonomia | read-only audyty, testy, docs, małe fixy z zielonym `test:quick`, re-run pomiarów, commity docs/test-only | działanie + raport ex post, bez pusha |
| 🟡 Batch GO  | implementacje P1/P2, nowe plany, commity kodu                                                             | jedno GO na paczkę                    |
| 🔴 Osobne GO | push, restart/migracje/seed, progi ML, prod DB, operacje destrukcyjne w gicie                             | zawsze jawna zgoda                    |

Twarde invarianty: GO na plan ≠ GO na kod; brak operacji na live DB poza drillem; progi ML tylko na danych; brak fallbacku do domyślnego `DATABASE_URL`; STOP przerywa paczkę natychmiast.
