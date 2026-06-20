TRYB KOMUNIKACJI: /caveman lite (zawsze). Komentarze w kodzie tylko po polsku. Odpowiedzi po polsku.

# WITROS Oferty PV — Dashboard stanu projektu

## ≡ Aktualny stan (2026-06-20)

| Obszar | Status | Szczegóły |
|--------|--------|-----------|
| TypeScript backend | ✅ OK | `tsc` — 0 błędów |
| TypeScript frontend | ✅ OK | `tsc -p tsconfig.frontend.json` — 0 błędów |
| Testy | ⚠️ 6 FAIL | 42 passed / 6 failed / 48 suites |
| Git branch | main | 74bd03a (ostatni: feat studnie Excel modal) |
| Niecommited | 56 modified, 4 untracked | ⚠️ dużo zmian czeka na commit |

### ❌ NAPRAWIONE błędy TS (ostatnia sesja)
- `app.js:65` — toggleCard konflikt sygnatur fixed (rest params)
- `shared/ui.js` — toggleCard unified (HTMLElement + string/string)
- `pvSalesUi.js` — getOrderForOffer @returns brak `orders` pola
- `pvSalesUi.js` — duplikat else if
- `types.d.ts` — showUniversalPrintModal: 1→3 parametry

### ❌ Niedziałające testy (4 pliki, 12 przypadków)
| Test | Ile FAIL | Prawdopodobna przyczyna |
|------|---------|------------------------|
| `printDispatch.test.ts` | ~5 | `relatedOrders` zmiana — test sprawdza stare wzorce |
| `studnieOrderExport.test.ts` | ~3 | Zmiana struktury orders/relatedOrders |
| `ruryOrderExport.test.ts` | ~3 | j.w. |
| Inne | ~1 | do sprawdzenia |

### 📋 Znane błędy (szczegóły: `docs/errors-known.md`)
1. Seed timeout na Render (SQLite busy_timeout)
2. Concurrent IIFE race condition (fixed)
3. XSS w innerHTML — zawsze escapeHtml()
4. Kalkulator comma/dot — `.replace(',', '.')`
5. PEHD button duplikacja stylów (fixed)
6. isLocked TDZ (fixed)
7. colspan 13→15 (fixed)
8. toggleAllItemsForOrder guard (fixed)
9. N+1 queries Prisma (pending)

---

## Operational Rules (MUST — bezwzględnie przestrzegaj)

### Graphify — pierwsze źródło wiedzy
- ZAWSZE używaj `graphify query "<question>"` przed grep/read dla każdego pytania o kod, zależności, architekturę.
- Zamiast `graphify query`, używaj `scripts/graphify-query.ps1 "<question>"` — cache'uje wyniki, oszczędza tokeny.
- Używaj `graphify path "<A>" "<B>"` dla relacji i `graphify explain "<concept>"` dla konceptów.
- Jeśli `graphify-out/wiki/index.md` istnieje (tylko z LLM/semantic extraction), czytaj go przed przeglądaniem plików. Bez LLM: używaj `GRAPH_REPORT.md` lub `graphify query`.
- `GRAPH_REPORT.md` czytaj TYLKO gdy `query/path/explain` nie dają odpowiedzi.
- Po KAŻDEJ modyfikacji kodu uruchom `graphify update .` (AST-only, bez kosztów API).

### Debugowanie błędów
- ZANIM zaczniesz debugować, sprawdź `docs/errors-known.md` — katalog znanych błędów z gotowymi fixami.

### Oszczędzanie tokenów
- **`/caveman lite`** — zawsze. Bez fillerów, uprzejmości, zbędnych zdań. Zwięźle, ale pełna treść techniczna.
- **graphify first** — graphify query/path/explain zamiast grep/read na ślepo. `scripts/graphify-query.ps1` cache'uje wyniki.
- **execute_code** — batch przetwarzania (3+ tool calls z logiką między nimi) w jednym skrypcie zamiast osobnych wywołań.
- **delegate_task** — równoległe zadania (research + review + implementacja) zamiast sekwencyjnie.
- **todo()** — śledź postęp przez todo, nie powtarzaj całej historii w każdej odpowiedzi.
- **Batch independent calls** — wiele read_file/search_files w jednej turze, nie jedno po drugim.
- **read_file z offset/limit** — czytaj tylko potrzebne linie, nie całe pliki.
- **search_files zamiast grepa** — szukaj przez tool, nie przez terminal (rg/grep w bashu).

## Frontend (JS) — konwencje
- **API**: używaj `api.get|post|put|del()` z `shared/api.js` — NIE używaj `fetch()` bezpośrednio
- **Style**: `classList.add/remove` zamiast `element.style.xxx`
- **Lucide**: `lucide.createIcons({root})` po każdym `innerHTML = ...`
- **Logger**: `window.logger.info|warn|error(tag, msg)` — NIE `console.log`
- **Toast**: `showToast(msg, type)` gdzie type = success|error|info
- **Confirm**: `appConfirm(msg)` zwraca Promise<boolean>
- **Escape**: `escapeHtml(str)` przy interpolacji HTML

## Skrypty npm
```bash
npm run dev                  # backend + frontend concurrently
npm run test                 # wszystkie testy
npm run typecheck            # tsc backend
npm run typecheck:frontend   # tsc frontend (używane dla public/js/)
npm run lint:frontend        # eslint public/js
npm run format               # prettier --write
```

## 🧠 System Agentów

Profesjonalne środowisko wieloagentowe — patrz `docs/AGENTS/README.md`.

| Agent | Rola | Dokument |
|-------|------|----------|
| Planista | Dekompozycja zadań | `docs/AGENTS/planista.md` |
| Koder | Implementacja + git workflow + test patterns | `docs/AGENTS/koder.md` |
| Reviewer | Code review (CRITICAL+INFORMATIONAL pass) | `docs/AGENTS/reviewer.md` |
| Architekt | Spójność + security audit + Prisma patterns | `docs/AGENTS/architekt.md` |

Każdy agent wywoływany przez `delegate_task(goal="...", skills="oferty-pv-<rola>")`.

Wybrane wytyczne z `.opencode/skills/` (OpenCode) zostały zintegrowane do agentów:
- `git-workflow` → koder (branch naming, conventional commits, PR template, merge strategy)
- `test-helper` → koder (wzorce testów: supertest, mocki Prisma, timeout)
- `review-checklist` + `security-audit` → reviewer (dwuetapowy CR, XSS, SQL injection, auth)
- `prisma-helper` + `security-audit` → architekt (Prisma patterns, security checklist)

## Git workflow
- Commituj po KAŻDEJ naprawie/testach
- Prefix: `typ(scope: opis` — patrz pełna konwencja w `docs/AGENTS/koder.md#git-workflow`
- Branch naming: `fix/`, `feat/`, `refactor/`, `chore/`, `docs/`, `perf/`, `test/`
- Merge: feature → squash, fix → merge commit, bez rebase na main
- Nie commituj na main bez typecheck OK
