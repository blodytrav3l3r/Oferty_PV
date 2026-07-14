# Conventions-LITE (CORE, ALWAYS LOADED, ~3.9 KB)

> Pełne konwencje (95 KB): skill `sp-a-conventions`. Ładuj **ręcznie** tylko gdy modyfikujesz
> architekturę SPA. Routing: `_router.md`.

## 1. Język

- Komentarze, dokumentacja, opisy commitów, CHANGELOG: **polski**
- Identyfikatory (`function fooBar`, `const MY_VAR`), klucze i18n: **angielski**
- Wyjątek: komentarze AI-agentom mogą być w EN jeśli context narzuca, ale PL preferowany

## 2. Wersja (SSoT)

| Plik                         | Rola                                               |
| ---------------------------- | -------------------------------------------------- |
| `VERSION` (root)             | **JEDYNE źródło prawdy** (np. `1.0.0`)             |
| `package.json` → `"version"` | mirror npm                                         |
| `CHANGELOG.md`               | historia, format Keep a Changelog (najnowsza górą) |

**Workflow**:

```bash
npm run version:check    # walidacja przed push (post-commit hook)
npm run version:patch    # bump PATCH (agent version-guardian ML/AI logika do CHANGELOG)
```

**Czego NIE ruszać** przy bumpie: tylko te 3 pliki. Nie tagować git-a (robi release flow).

## 3. Bug-fix flow (`/caveman lite`)

- **Prosty fix** (1-2 pliki): od razu patch → verify. Bez planu.
- **Nowy feature / >3 pliki**: `.hermes/plan-modernizacja.md` lub nowy plan → execute.
- Po patchu TypeScript: `npm run typecheck`
- Po patchu frontend JS: `npm run typecheck:frontend`
- Browser: `Ctrl+Shift+R` po dużej zmianie CSS.
- NIE uruchamiaj `npm run dev.bat` w bash (problemy z `2^>nul`) — `npm run dev:backend`.

## 4. SPA (jedyne entry-point)

- `app.html` = jedyny entry-point dla modułów (studnie, rury, kartoteka, zlecenia)
- Moduły (`studnie.html`, etc.) działają jako iframe w `app.html` (router SPA)
- UI w toolbarze `app.html` (obok "Wyloguj"), **NIE w module HTML** --
  router ukrywa `.header` iframe'a (`router.js:240-242`)
- Bezpośredni URL modułu → redirect do `app.html#/<module>` (skrypt w każdym HTML)
- `<footer>` w module HTML — **usunięty** (commit `0b213e6`). Wersja SSoT żyje w toolbara `app.html`.

**Nagłówki h1/h2/h3** w module: solid backgrounds, sticky z-index 50+isolate.

## 5. Commit convention

- **conventional-commits** (commitlint na husky)
- Type: `feat|fix|refactor|chore|docs|perf|test|style`
- Scope: z `commitlint.config.js` scope-enum (m.in. release, api, ui, studnie, rury ...)
- Title wielomianowo: "przeniesienie wersji do toolbara"
- Body: wyjaśnienie co/dlaczego po polsku

## 6. ~~Python (`well_configurator_backend/`)~~ — usunięty

## 7. Cache & deploy

- Express: `Cache-Control: no-store` dla HTML (router + strony entry)
- Assets (`public/**`): domyślny cache Vite/Express
- Browser: `Ctrl+Shift+R` dla czystego stanu po dużej zmianie CSS/JS
- CSS/JS tag `?v=N` w linku/script: bump przy istotnych zmianach (cache-buster)

## 8. Seed/Smoke tests

- `npm run test:quick` (Jest bez coverage) przed pushem
- `python scripts/excel-validator.py` (pre-commit hook) czy plan napraw Excel jest wdrożony
- `npm run version:check` (post-commit hook) czy wersja spójna

## 9. Hermes skills (\u015brod\u0142o minimalne)

- Skile są routingowany przez `_router.md`; nie ładuj preventywnie (95 KB conventions = marnotrawstwo)
- Każdy specjalistyczny skill z manifestu (43 referencji w 7 plikach w profile `pv`):

## 10. Brak rzeczy bardzo wa\u017cnych

- NIE mutuj `data/app_database.sqlite` (lock); commit mtime-only diff jest OK ale nie wciągaj go.
- NIE ignoruj `.gitignore` (plan-modernizacja, secrets).
- NIE pisz w Python kod przeznaczony dla Node.js backend.

Pełne reguły: skill `sp-a-conventions` (95 KB), references/SPA-architecture-app-wrapper.md, references/SPA-toolbar-pattern.md, references/SPA-single-entrypoint.md, references/excel-copy-paste-cell-select.md, references/excel-auto-manual-sync.md, references/solver-architecture.md, references/verify-after-mutation.md, references/windows-hookchain-traps.md, references/project-structure-cleanup.md, references/modernization-workflow.md, references/pre-existing-test-fixes.md
