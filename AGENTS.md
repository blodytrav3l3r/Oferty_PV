TRYB KOMUNIKACJI: /caveman lite (zawsze). Komentarze w kodzie tylko po polsku. Odpowiedzi po polsku.

## Operational Rules (MUST — bezwzględnie przestrzegaj)

### Graphify — pierwsze źródło wiedzy
- ZAWSZE używaj `graphify query "<question>"` przed grep/read dla każdego pytania o kod, zależności, architekturę.
- Zamiast `graphify query`, używaj `scripts/graphify-query.ps1 "<question>"` — cache'uje wyniki, oszczędza tokeny.
- Używaj `graphify path "<A>" "<B>"` dla relacji i `graphify explain "<concept>"` dla konceptów.
- Jeśli `graphify-out/wiki/index.md` istnieje (tylko z LLM/semantic extraction), czytaj go przed przeglądaniem plików. Bez LLM: używaj `GRAPH_REPORT.md` lub `graphify query`.
- `GRAPH_REPORT.md` czytaj TYLKO gdy `query/path/explain` nie dają odpowiedzi.
- Po KAŻDEJ modyfikacji kodu uruchom `graphify update .` (AST-only, bez kosztów API).

### Debugowanie błędów
- ZANIM zaczniesz debugować, sprawdź `.kilo/plans/errors-known.md` — katalog znanych błędów z gotowymi fixami.

## Frontend (JS) — konwencje
- **API**: używaj `api.get|post|put|del()` z `shared/api.js` — NIE używaj `fetch()` bezpośrednio
- **Style**: `classList.add/remove` zamiast `element.style.xxx`
- **Lucide**: `lucide.createIcons({root})` po każdym `innerHTML = ...`
- **Logger**: `window.logger.info|warn|error(tag, msg)` — NIE `console.log`
- **Toast**: `showToast(msg, type)` gdzie type = success|error|info
- **Confirm**: `appConfirm(msg)` zwraca Promise&lt;boolean&gt;
- **Escape**: `escapeHtml(str)` przy interpolacji HTML
