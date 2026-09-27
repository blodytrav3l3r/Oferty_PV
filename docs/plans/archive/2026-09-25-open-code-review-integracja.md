# Integracja open-code-review (Alibaba OCR) — globalnie + S.O.K.

**Wersja:** 1.0 (2026-09-25)
**Status:** plan aktywny
**Decyzje:** zakres global+projekt, model OCR = ten sam co opencode, tryb manual-only

## 1. Wersje zweryfikowane (2026-09-25)

| Komponent                         | Wersja                            | Wniosek                                                                                 |
| --------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------- |
| `opencode --version`              | **1.18.21**                       | linia **V1** — plugin używany przez entrypoint `server`                                 |
| `opencode2 --version`             | brak binarki                      | ścieżka V2 (`id` + `setup`) w pliku pozostaje uśpiona, nieszkodliwa (import typów only) |
| `ocr version`                     | **v1.12.9** windows/amd64         | wspiera `review`, `scan`, `delegate`, `--preview`, `--background-file` — wystarczy      |
| `node --version`                  | v24.18.0                          | OK (>=22.13.0 wg `package.json`)                                                        |
| `~/.config/opencode/package.json` | `@opencode-ai/plugin` **1.15.10** | **rozjazd vs binarka 1.18.21** → podbić do `1.18.17` (jak w projekcie)                  |
| `.opencode/package.json` (S.O.K.) | `@opencode-ai/plugin` **1.18.17** | zgodne z binarką 1.x — **bez zmian**                                                    |

### Co to zmienia w instalacji (vs generyczne README)

1. **Tylko jeden pakiet runtime.** README każe dobrać deps do wersji:
   V1 → sam `@opencode-ai/plugin`, V2 → oba (`@opencode-ai/plugin` + `@opencode/plugin@beta`).
   Mamy czystą V1, więc **nie instalujemy `@opencode/plugin@beta` nigdzie**.
2. **Globalny bump 1.15.10 → 1.18.17.** Dryf minor między SDK pluginu a binarką grozi
   rozjazdem API `tool`/`config`. Komenda w Fazie 1. Projekt już na 1.18.17 — nic nie ruszać.
3. **Brak wpisu w `plugin[]`.** Oba `opencode.json` ładują pluginy z katalogu `plugins/`
   przez autodiscovery — wystarczy położyć plik. Jawny wpis zbędny
   (istniejące wpisy ponytail/graphify są tam bo leżą poza standardową ścieżką).
4. **Restart po instalacji obowiązkowy** — inaczej w logu serwera `Cannot find package ...`.
5. **Windows:** `chmod 0700/0600` pomijane na win32, group-kill przez `taskkill /T /F`,
   cleanup tmp z retry pod AV — nic do konfigurowania.

## 2. Co daje plugin

- Tools: `ocr_review` (workspace / `--commit` / `--from+--to` / `--resume`, JSON),
  `ocr_health` (`version` + `llm test`).
- Komendy `/ocr-review`, `/ocr-health` z guardami `??=` — nie nadpiszą `/code-review`.
- Limity: timeout domyślny 30 min, cap 10 MiB, `preview=true` bez kosztu LLM.
- `background` xor `backgroundFile` (file >8000 znaków przez tmp, sprzątany zawsze).

## 3. Realizacja

### Faza 0 — Konfiguracja OCR (osobne GO na klucz API)

```powershell
ocr config provider
ocr config model      # model aktualnie wybrany w opencode (decyzja)
ocr llm test
```

### Faza 1 — Instalacja globalna

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.config\opencode\plugins"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/alibaba/open-code-review/main/plugins/open-code-review/opencode/open-code-review.ts" -OutFile "$env:USERPROFILE\.config\opencode\plugins\open-code-review.ts"
npm install --prefix "$env:USERPROFILE\.config\opencode" @opencode-ai/plugin@1.18.17
```

Restart opencode. Test: `/ocr-health`, potem `/ocr-review` z `preview=true`.

### Faza 2 — Instalacja w S.O.K. (commit do repo)

```powershell
New-Item -ItemType Directory -Force ".opencode\plugins"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/alibaba/open-code-review/main/plugins/open-code-review/opencode/open-code-review.ts" -OutFile ".opencode\plugins\open-code-review.ts"
```

Bez zmian w `opencode.json` i `package.json` (1.18.17 już jest).
Uwaga: `.opencode/` jest w `.gitignore` („Opencode auto-generated") — plik pluginu
działa lokalnie, zespół powtarza instalację (nie `git add -f` wbrew konwencji repo).

### Faza 3 — Użycie w S.O.K. (manual-only)

- `exclude`: `node_modules,dist,coverage,graphify-out,playwright-report,test-results,*.sqlite,data/backups/*,.env`.
- `background`: krótki kontekst (np. „moduł studnie, sortowanie tylko po DN; AGENTS.md §4")
  albo `backgroundFile` do `docs/plans/*.md` przy długim kontekście.
- Podział: `/code-review` = szybki check lokalny, `/ocr-review` = głębokie review przed pushem.

### Faza 4 — Walidacja

`/ocr-health` (global + projekt) → `/ocr-review` preview → mały realny review (JSON `file:line`)
→ `npm run version:check` → `npm run encoding:check` → `npm run validate` → `npm run format`.

## 4. Ryzyka

- Upgrade opencode do 2.x → doinstalować `@opencode/plugin@beta` w obu lokalizacjach.
- AV blokuje tmp → review działa, możliwy warning cleanup.
- Zawsze najpierw `preview=true` (koszt LLM).
- Brak wpinania w `validate`/husky/CI (decyzja manual-only).

## 5. Realizacja (2026-09-25, wykonano)

- Plik pluginu (sha256 `A340C9…DD09`, 22706 B, identyczny z upstream main):
  `~/.config/opencode/plugins/open-code-review.ts` + `.opencode/plugins/open-code-review.ts`.
- Global SDK podbity `@opencode-ai/plugin` 1.15.10 → **1.18.17** (zgodnie z binarką).
- LLM: custom provider `omniroute` → `http://localhost:20128/v1` (protocol openai),
  model **`cfp/deepseek-ai/deepseek-v4-flash-0731`** (= rodzina DeepSeek V4 Flash).
  Uzasadnienie: `opencode-zen/*-free` wołane spoza opencode dostaje 403
  („free tier can only be used from within OpenCode"), `oc/...` unavailable,
  `dva/...` 500 (błąd konfiguracji mostka po stronie serwera — poza zakresem).
  Klucz API w `~/.opencodereview/config.json` (reuse klucza `omni_route` z auth.json opencode).
- Walidacja: `ocr llm test` ✓, `ocr review --preview` ✓ (1 plik),
  `version:check` ✓, `encoding:check` ✓ (1942 OK), prettier nowego pliku ✓.
- Po restarcie opencode: `/ocr-health`, `/ocr-review` (najpierw z `preview=true`).
- Commit proponowany (osobne GO, tylko plan): `node scripts/commit.mjs "docs(config): plan integracji open-code-review"`.
