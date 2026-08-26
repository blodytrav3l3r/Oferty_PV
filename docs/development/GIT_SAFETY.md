# GIT SAFETY — Specyfikacja Bezpieczeństwa Repozytorium (SSoT)

> Specyfikacja v1.0.0 — Etap 1 (specyfikacja, zero implementacji)
> Status: Zatwierdzony — plan 0–8 zamknięty
> Źródło prawdy: Ten plik. Wszystkie `docs/plans/archive/*.md` są historyczne i nie mogą definiować nowych reguł Git bez zgodności z tym dokumentem.

---

## 1. Cel

Gwarancja:

> **Żadna automatyczna operacja ani agent nie może przypadkowo zniszczyć niecommitowanej pracy użytkownika.**

Jednocześnie guard nie blokuje normalnej pracy Git.

Pięć funkcji systemu rozróżnionych świadomie:

- **informowanie** → dokumentacja (ten plik + `AGENTS.md` / rules),
- **wykrywanie** → guard (`WorktreeState` dirty/clean),
- **ochrona** → automatyczny snapshot **przed** destrukcją,
- **destrukcja** → jawna autoryzacja,
- **odzysk** → zweryfikowany mechanizm recovery.

---

## 2. Scope — operacje destrukcyjne

### 2.1 Tier A — utrata working tree / index

| Operacja                                       | Poziom       | Uwagi                                                |
| ---------------------------------------------- | ------------ | ---------------------------------------------------- |
| `git restore <path>` / `git restore .`         | **HIGH**     | nadpisuje working tree                               |
| `git checkout -- <path>` / `git checkout -- .` | **HIGH**     | legacy alias `restore`                               |
| `git reset --hard`                             | **CRITICAL** | zawsze wymaga potwierdzenia, nawet na pozornie clean |
| `git clean -f` / `git clean -fd`               | **CRITICAL** | usuwa untracked                                      |
| `git clean -fdx`                               | **CRITICAL** | usuwa także ignored — osobna polityka `ignored`      |

### 2.2 Tier B — utrata / zmiana historii

| Operacja                                  | Poziom               | Uwagi                                     |
| ----------------------------------------- | -------------------- | ----------------------------------------- |
| `git reset` (soft/mixed)                  | **HISTORY-CRITICAL** | nie zawsze niszczy worktree — osobny gate |
| `git rebase`                              | **HISTORY-CRITICAL** |                                           |
| `git commit --amend`                      | **HISTORY-CRITICAL** |                                           |
| `git cherry-pick` / `git revert`          | **HISTORY-CRITICAL** |                                           |
| `git push --force` / `--force-with-lease` | **HISTORY-CRITICAL** |                                           |

> Tier A i Tier B nie są jednym workiem. Worktree / index / history — każdy ma własny gate.

### 2.3 Harmless — zawsze dozwolone

`status`, `diff`, `log`, `show`, `add`, `commit` (bez `--amend`), `fetch`, `pull --ff-only`, `push` (bez `--force`). Guard nie ingeruje.

---

## 3. Architektura

```text
                    ┌─────────────────────┐
                    │     WORKTREE        │
                    │ staged/unstaged/    │
                    │ untracked changes   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Git Safety Layer  │
                    └──────────┬──────────┘
                               │
             ┌─────────────────┼─────────────────┐
             │                 │                 │
             ▼                 ▼                 ▼
       READ-ONLY Git      DESTRUCTIVE Git    NORMAL Git
       status/diff        restore/reset      add/commit/push
             │                 │
             │                 ▼
             │          ┌───────────────┐
             │          │  Safety Gate  │
             │          └───────┬───────┘
             │                  │
             │            dirty changes?
             │              /        \
             │            NO          YES
             │            │            │
             │            ▼            ▼
             │         proceed    snapshot
             │                         │
             │                         ▼
             │                   verify snapshot
             │                         │
             │                    ┌────┴────┐
             │                    │         │
             │                  FAIL      OK
             │                    │         │
             │                   STOP      ▼
             │                         authorization
             │                              │
             │                              ▼
             │                         destructive op
             │
             ▼
          harmless
```

### 3.1 Enforcement ≠ policy

- `core.hooksPath` + `git alias checkout` **nie zapewniają** enforcement — Git nie ma `pre-checkout`/`pre-restore`, alias omijalny (`git restore` bezpośrednio, `node` `spawn git`).
- Husky nie jest granicą bezpieczeństwa — dotyczy `pre-commit`/`pre-push`, nie `restore`/`reset`/`clean`.
- Enforcement to: **repository-local `git` wrapper w `PATH`** + hook gdzie Git wspiera + **detection/audit bypassów**. `safe-*` CLI to wygodny interfejs, nie brama.

Na Windows (środowisko tego repo) wrapper musi być testowany osobno dla **PowerShell, Git Bash i procesów Node** — nie zakładać, że alias wystarczy.

---

## 4. Kontrakt Safety Engine (Etap 2 — przed modułami)

Najpierw model, potem implementacja:

```text
Operation          { tier, command, args, level: HIGH|CRITICAL|HISTORY-CRITICAL }
WorktreeState      { staged: File[], unstaged: File[], untracked: File[], ignored: File[], branch, HEAD, statusText }
Snapshot           { id, timestamp, operation, head, branch, worktreeState, paths: { diffPatch, untrackedTar, metadataJson } }
VerificationResult { ok: boolean, expectedFiles: number, snapshotFiles: number, reason?: string }
Authorization      { confirmed: boolean, snapshotId, operation }
RecoveryResult     { ok: boolean, restoredFiles: number, snapshotId }
```

Dopiero na tym kontrakcie:

```text
detect(WorktreeState) → snapshot(Snapshot) → verify(VerificationResult) → authorize(Authorization) → recover(RecoveryResult)
```

Nie pięć luźnych skryptów.

---

## 5. Snapshot — przed destrukcją, nie po

Kolejność obowiązkowa:

```text
destructive operation
        ↓
dirty?
        ↓
YES → create safety snapshot
        ↓
verify snapshot
        ↓
ONLY THEN permit destruction
```

Zakres snapshotu:

- `staged` + `unstaged` + `untracked` — zawsze.
- `ignored` — **świadoma polityka**, nie przypadkowe `-x`. `clean -fdx` wymaga osobnego potwierdzenia CRITICAL z ostrzeżeniem o `ignored`.

Lokalizacja (propozycja, finalna w Etapie 2):

```text
.git/safety/snapshots/<ISO8601>-<shortId>/
    metadata.json
    status.txt        # git status --short --ignored
    diff.patch        # git diff HEAD + git diff --staged
    untracked.tar     # untracked files
```

`metadata.json` minimalnie:

```json
{
    "snapshotId": "20260826T194231Z-a81f2c",
    "timestamp": "2026-08-26T19:42:31Z",
    "operation": "restore .",
    "branch": "main",
    "head": "c9645ba...",
    "level": "HIGH",
    "worktreeState": { "staged": 2, "unstaged": 9, "untracked": 1 }
}
```

---

## 6. Weryfikacja snapshotu

Nie:

```text
stash → OK → restore
```

tylko:

```text
snapshot → verify → snapshot contains expected changes? → YES→destruct / NO→STOP
```

Guard musi stwierdzić: _„Przed operacją było 11 zmienionych plików i snapshot faktycznie zawiera ich stan”_. `VerificationResult.ok === false` → `STOP`, destrukcja nie następuje.

---

## 7. Jawna autoryzacja

Po `verify === OK` system wymaga świadomego potwierdzenia:

```text
WARNING: destructive Git operation
Worktree: 11 modified, 1 untracked
Snapshot: 20260826T194231Z-a81f2c
Operation: git restore .
This will discard the current working-tree state.
Continue? [y/N]
```

Dla agenta: `git safety restore --target=. --confirm` — bez `--confirm` → `STOP`.

---

## 8. Recovery jako funkcja systemu

Nie `git fsck` / `reflog` jako pierwszy odzysk.

```bash
npm run git:safety:list
npm run git:safety:inspect <snapshot-id>
npm run git:safety:restore <snapshot-id>
npm run git:safety:verify <snapshot-id>
```

Hierarchia odzysku (od L1 w górę, nie odwrotnie):

```
L1  safety snapshot   ← podstawowy
L2  Git stash / reflog
L3  Git dangling objects / fsck
L4  IDE Local History
L5  ręczne odtwarzanie
```

`42afa2f` uratował pracę przypadkowo jako dangling — to nie system backupu. `fsck` to ostatnia linia, nie pierwsza.

---

## 9. Agent policy

`AGENTS.md` to _co robić_, nie jedyne zabezpieczenie. Reguły dla agenta (do `AGENTS.md` + `.opencode/rules/common/git-workflow.md` w Etapie 5):

```text
Never use a destructive Git operation to resolve a build, test, lint or typecheck failure.
Never discard working-tree changes unless the user explicitly requested that exact destructive operation.
Before any destructive Git operation, create and verify a safety snapshot.
If the snapshot cannot be created or verified, STOP.
```

Zabroniony **wzorzec działania**, nie pojedyncza komenda.

---

## 10. Reguła diagnostyczna

```text
BUILD/TEST/TYPECHECK FAILURE → diagnose → fix code → rerun check
```

Nigdy:

```text
FAIL → restore files → PASS   # fałszywie zielone CI, funkcjonalność znika
```

To formalny **anti-pattern development workflow**. Typecheck failure nigdy nie jest powodem do `checkout --`/`restore`/`clean`.

---

## 11. Poziomy destrukcji

```
HIGH:              restore, checkout -- <path>
CRITICAL:          reset --hard, clean -fd, clean -fdx
HISTORY-CRITICAL:  rebase, reset branch, commit --amend, push --force
```

Każda klasa — inny poziom potwierdzenia.

---

## 12. Guard nie blokuje normalnego Git

```
status/diff/log/show  → zawsze OK
add/commit/fetch      → zawsze OK
restore/reset --hard/clean → safety gate
```

---

## 13. Testy bezpieczeństwa (Etap 6–7)

### 13.1 Jednostkowe (Etap 6)

`dirty tracked`, `dirty staged`, `dirty unstaged`, `untracked`, `multiple modified`, `rename`, `delete`, `binary`, `large diff`, `empty worktree`, `stash failure`, `snapshot verify fail`, `restore fail`.

Scenariusze:

```
1. dirty → destructive → snapshot exists
2. snapshot failure → destructive NOT executed
3. clean → destructive allowed
4. untracked → preserved
5. staged + unstaged → both recoverable
6. recovery → original worktree restored
```

### 13.2 Katastroficzny (Etap 7)

```
create fake repo → 10 modified + staged + untracked → safety-protected restore → verify → destruct → recover → compare SHA/content
BEFORE SHA == AFTER SHA   # dla całego chronionego stanu
```

---

## 14. Rollout 0–8 (zamknięty)

| Etap  | Zakres                     | Artefakt                               | Zasada                                                                                                 |
| ----- | -------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 0     | Audyt                      | zero zmian                             | `core.hooksPath`, Husky, `.opencode/rules`, `AGENTS.md`, `CONTRIBUTING.md`, `scripts/*`, worktrees, CI |
| **1** | **Specyfikacja**           | **ten plik**                           | SSoT, Tier A/B, 5 zasad — **zero kodu**                                                                |
| 2     | Safety engine              | `scripts/git-safety/`                  | kontrakt → `detect/snapshot/verify/authorize/recover`                                                  |
| 3     | CLI                        | `npm run git:safety:*`                 | `list/inspect/restore/verify`                                                                          |
| 4     | Enforcement                | wrapper w PATH + audit                 | Tier A gate, `clean -fdx` CRITICAL, Windows PowerShell/Bash/Node                                       |
| 5     | Agent policy               | `AGENTS.md` + `rules`                  | 4 reguły + anti-pattern                                                                                |
| 6     | Testy                      | `tests/git-safety/`                    | jednostkowe + scenariuszowe                                                                            |
| 7     | Katastroficzny             | `tests/git-safety/catastrophic.test.*` | `BEFORE==AFTER`                                                                                        |
| 8     | Migracja docs + obserwacja | `archive/*.md DEPRECATED`              | dopiero po wdrożeniu, retention po tygodniach                                                          |

**Czego nie robić:** opierać się tylko na `AGENTS.md` / Husky / aliasie / stash 30 min / Local History / `fsck` / zakazie jednej komendy.

---

## 15. Dokumentacja po wdrożeniu (Etap 8)

Dopiero po Etapie 4 oznaczyć w `archive/*.md` błędne instrukcje (`PLAN_NAPRAWY_v3.md:28-36,558`, `master-plan-refaktoryzacji.md:773,889-892` itd.) jako `DEPRECATED — wymaga snapshot→verify→authorize`. Procedura rollback w archiwach zastąpiona 5-krokiem:

```
1. git status --short
2. dirty → snapshot
3. verify sukces
4. authorize
5. dopiero rollback
```

---

> **Granica planu:** od Etapu 1 nie dodajemy warstw/wyjątków/formatów/retention bez osobnej decyzji. Następny krok to Etap 0 audyt (read-only), potem Etap 2 kontrakt — bez wcześniejszej implementacji.
