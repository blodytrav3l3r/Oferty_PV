# Git Workflow (zaadaptowano pod S.O.K.)

> Zrodlo: ECC common/git-workflow.md. Format commitow zgodny z commitlint projektu
> (typ(scope): opis, <=72 znaki, lista scope). Uzywaj `node scripts/commit.mjs` zamiast
> surowego `git commit -m` - chroni polskie znaki przed mojibake w konsoli Windows.

## Commit Convention (Conventional Commits)

**Format: `typ(scope): opis`**

Dozwolone typy: `feat, fix, refactor, chore, docs, perf, test, style`

Dozwolone scope (lista z commitlint): `rury, studnie, offers, orders, prisma, auth, ui, api,
seed, deploy, clients, audit, settings, preco, telemetry, deps, docs, ci, config, test,
docker, security, chore, release`

Reguly:

- Naglowek <= 72 znaki
- Temat i scope malymi literami
- Temat nie konczy sie kropka
- Body i opis po polsku

Przyklady:

```
feat(studnie): nowa kolumna w excel
fix(rury): naprawa sortowania srednic
refactor(offers): wyodrebnienie kalkulacji
chore(deps): aktualizacja express
```

## Pre-Commit Checklist (OBOWIAZKOWE)

Przed kazdym commitem:

- [ ] `npm run version:check` (spojnosc wersji - rozjazd = blokada)
- [ ] `npm run validate` (typecheck + lint + testy)
- [ ] `npm run format` (Prettier)

## Commit Process

```bash
# Zalecany helper (bez mojibake z konsoli Windows)
node scripts/commit.mjs "fix(config): naprawa wersji w docs"
node scripts/commit.mjs "feat(studnie): nowa kolumna w excel" "linia body" "kolejna linia"
node scripts/commit.mjs --amend "fix(config): poprawka tresci"
```

Husky pre-commit hook waliduje reguly commitlint. Znany problem z hookiem
(`well.magazyn`) - obejscie:

```bash
git -c core.hooksPath=/dev/null commit -m "typ(scope): opis"
```

Obejscie hooka NIE zwalnia z `npm run version:check` i `npm run validate`.

## Release Flow

Wersjonowanie przez `npm run release` (dobor patch/minor/major na bazie commitow):

```bash
npm run release          # automatyczny dobór
npm run release:patch    # wymuszenie patch
npm run release:minor    # wymuszenie minor
npm run release:major    # wymuszenie major
git push --follow-tags
```

Release aktualizuje: `VERSION`, `package.json`, `CHANGELOG.md`, `?v=` w HTML (cache-bust),
wersje w `.bat`, markery wersji w docs. **Nigdy nie taguj gita recznie.**

Po kazdym release: `npm run version:check` i potwierdz EXIT=0 przed `git push --follow-tags`.

## Pre-Push Validation

Husky pre-push uruchamia:

- `npm run version:check`
- `npm run encoding:check`
- `npm run typecheck` + `npm run typecheck:frontend`
- `npm run test:quick`

Jesli hook blokuje push: `git -c core.hooksPath=/dev/null push` (lub `HUSKY=0 git push`).

## Branching

- Pracujesz na `main` - to jedyna galezie
- Branch tworz tylko dla zlozonych zadan

## Git Safety (Tier A — SSoT `docs/development/GIT_SAFETY.md`)

- **Nigdy nie używaj destrukcyjnego Git do naprawy build/test/lint/typecheck.** `FAIL → diagnose → fix code → rerun`, nigdy `FAIL → restore/clean → PASS`.
- **Przed destrukcją Tier A** (`checkout --`, `restore`, `reset --hard`, `clean -f/-fd/-fdx`) → `dirty → snapshot → verify → authorization (--force) → exec`. `verify FAIL` → `STOP`.
- **Agent MUST use Git Safety workflow i MUST NOT bypass safety layer.** `spawnSync('git')` bez `shell:true` omija wrapper — udokumentowany bypass.
- **Snapshot L1:** `.git/safety/snapshots/<ISO>-<id>/` + `npm run git:safety:list|inspect|verify|restore --force`
- **Protected:** PowerShell/Git Bash/`shell:true` → wrapper. **Known bypass:** direct `git.exe`.
- Tier A HIGH: `restore`/`checkout --`; CRITICAL: `reset --hard`/`clean -f*` (`-fdx` też `ignored`). Harmless (`status/diff/add/commit`) zawsze OK.

## Anti-Patterns

- Commituj bezpośrednio na main bez walidacji
- Ręczne tagowanie gita (zawsze `npm run release`)
- Ręczna edycja `?v=` w HTML (synchronizacja tylko przez release)
- Pomijanie `version:check` przy drobnych poprawkach dokumentacji - rozjazd w JAKIMKOLWIEK miejscu = blokada
- **Destrukcyjne Git na dirty bez snapshotu** (`checkout --`/`restore`/`reset --hard`/`clean -f*` na dirty bez `snapshot→verify→--force`) — utrata pracy
- **Naprawianie `typecheck:frontend FAIL` przez czyszczenie plików** (`restore`/`checkout --` by uzyskać PASS) — fałszywie zielone
- **Bypass safety layer** (`spawnSync('git')` bez shella by ominąć wrapper) — zakazany dla agenta