# S.O.K. — Agent: commity, wersje, release, plany

> Szczegółowy przewodnik domenowy. Root: `AGENTS.md` (mapa + bramy).

## Commity (commitlint + encoding)

- Format `typ(scope): opis`: typ ∈ `feat, fix, refactor, chore, docs, perf, test, style`; scope z listy (`rury, studnie, offers, orders, prisma, auth, ui, api, seed, deploy, clients, audit, settings, preco, telemetry, deps, docs, ci, config, test, docker, security, chore, release`); nagłówek ≤ 72 znaki; małe litery; bez kropki na końcu. Hook `commit-msg` blokuje naruszenia.
- Zawsze `node scripts/commit.mjs "..."` (lub `npm run commit`) — chroni polskie znaki (UTF-8 przez plik) i waliduje przed hookiem.
- Język: odpowiedzi/plany po polsku; komentarze/commity/CHANGELOG po polsku; identyfikatory w kodzie po angielsku.
- Przed commitem: `npm run version:check` + `npm run validate` + `npm run format`.
- Zgodę na commit i push określa `docs/AUTONOMY_CONTRACT.md`: commit kodu wymaga GO na paczkę, a push — osobnego GO z dokładnym celem `remote/branch`.
- Przed pushem uruchom obowiązkowe hooki bez pomijania ich. Hook `pre-push` wykonuje ceny, lint, typecheck i testy; skonfiguruj wymagane połączenie z testową bazą zamiast omijać kontrolę.
- Po pushu sprawdź kod wyjścia oraz `git status -sb`; szczegóły interpretacji na Windows są w `docs/agents/commands.md`.

## Wersje (SSoT: plik VERSION)

- Nie edytuj ręcznie wersji w `package.json`, `CHANGELOG.md`, `*.bat`, `?v=` w HTML ani markerów w docs — robi to wyłącznie `npm run release` (hook `postbump` = `npm run version:propagate && git add -u`, więc propagacja wchodzi do commita release).
- Nie dodawaj do docs nowych formatów markerów wersji poza obsługiwanymi przez `auto-docs-version.mjs`.
- Po release: `npm run version:check` (EXIT=0) przed `git push --follow-tags`. Nigdy nie taguj ręcznie. Po zmianie wersji restart backendu.

## Plany

- Wszystkie plany/taski (`.md`) w `docs/plans/` (wyjątek: `.hermes/`, `.opencode/`).
- Zakończone: `git mv` do `docs/plans/archive/` (zachowanie historii).
