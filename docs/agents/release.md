# S.O.K. — Agent: commity, wersje, release, plany

> Szczegółowy przewodnik domenowy. Root: `AGENTS.md` (mapa + bramy).

## Commity (commitlint + encoding)

- Format `typ(scope): opis`: typ ∈ `feat, fix, refactor, chore, docs, perf, test, style`; scope z listy (`rury, studnie, offers, orders, prisma, auth, ui, api, seed, deploy, clients, audit, settings, preco, telemetry, deps, docs, ci, config, test, docker, security, chore, release`); nagłówek ≤ 72 znaki; małe litery; bez kropki na końcu. Hook `commit-msg` blokuje naruszenia.
- Zawsze `node scripts/commit.mjs "..."` (lub `npm run commit`) — chroni polskie znaki (UTF-8 przez plik) i waliduje przed hookiem.
- Język: odpowiedzi/plany po polsku; komentarze/commity/CHANGELOG po polsku; identyfikatory w kodzie po angielsku.
- Przed commitem: `npm run version:check` + `npm run validate` + `npm run format`.

## Wersje (SSoT: plik VERSION)

- Nie edytuj ręcznie wersji w `package.json`, `CHANGELOG.md`, `*.bat`, `?v=` w HTML ani markerów w docs — robi to wyłącznie `npm run release` (hooki `postbump`: cache-bust, docs, bat).
- Nie dodawaj do docs nowych formatów markerów wersji poza obsługiwanymi przez `auto-docs-version.mjs`.
- Po release: `npm run version:check` (EXIT=0) przed `git push --follow-tags`. Nigdy nie taguj ręcznie. Po zmianie wersji restart backendu.

## Plany

- Wszystkie plany/taski (`.md`) w `docs/plans/` (wyjątek: `.hermes/`, `.opencode/`).
- Zakończone: `git mv` do `docs/plans/archive/` (zachowanie historii).
