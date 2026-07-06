# A.5 — Bezpieczeństwo / XSS

**Data:** 2026-07-04

---

## 1. `aiDashboard.js` — audyt `innerHTML`

**Funkcja `escapeHtml()`:** zdefiniowana i używana w 100% przypadków interpolacji danych użytkownika.

| Miejsce | Dane | escapeHtml? |
|---------|------|-------------|
| `statCard()` — tytuł | `title` | ✅ |
| Rozkład typów — klucz | `kv[0]` (patternType) | ✅ |
| Tabela wzorców — `patternKey` | `p.patternKey` | ✅ |
| Tabela wzorców — `description` | `p.description` | ✅ |
| Detale — `DN` | `p.dn` | ✅ |
| Detale — `status` | `p.status` | ✅ |
| Detale — rekomendacja JSON | `rec` | ✅ |
| Panel preferencji — DN | `String(dn)` | ✅ |
| Panel preferencji — warningi | `data.warnings` | ✅ |
| Panel preferencji — unikane produkty | `pid` (productId) | ✅ |
| Panel preferencji — preferowane produkty | `pid` (productId) | ✅ |
| Panel preferencji — ring height key | `kv[0]` (height) | ✅ |
| Status — lastRun | `lastRun` | ✅ |
| Brak wzorców — dnFilter | `dnFilter` | ✅ |

**Wniosek:** XSS w aiDashboard.js = **NIE**. Wszystkie dane z API są escape'owane.

---

## 2. CSP (Content Security Policy)

**AGENTS.md (Helmet config):**
```
scriptSrc: ["'self'", "'unsafe-inline'"]
```

**Inline `onclick` w aiDashboard.js:**
```javascript
onclick="var d=document.getElementById(\'' + detailId + '\');..."
```
- `detailId` to `'ai-pattern-detail-' + idx` (indeks numeryczny 0..49) — **brak user-supplied danych**
- CSP `'unsafe-inline'` zezwala na inline onclick → **bezpieczne**

**Wniosek:** CSP nie blokuje dashboardu.

---

## 3. Walidacja inputów — `POST /api/learning/cases`

| Pole | Walidacja | Status |
|------|-----------|--------|
| `dn` | `typeof body.dn !== 'number'` → 400 | ✅ |
| `totalHeightMm` | `typeof body.totalHeightMm !== 'number'` → 400 | ✅ |
| `wellType` | `!body.wellType` → 400 | ✅ |
| `componentSeq` | Brak TypeScript runtime check (tylko `as unknown[]`) | ⚠️ |
| `diameterProfile` | Brak TypeScript runtime check | ⚠️ |
| `transitions` | Brak TypeScript runtime check | ⚠️ |

**Ryzyko:** Ktoś może przesłać `componentSeq: "złośliwy string"` zamiast tablicy.
Będzie przekazane do `createOrUpdate()` → `JSON.stringify(body.componentSeq)` → zadziała
(skompiluje do stringa). **Nie powoduje crasha**, ale zanieczyszcza dane.

**Status:** MINOR — brak walidacji na głębszym poziomie (nie sprawdza czy to Array z obiektami).

---

## 4. Rate limiting

| Endpoint | Limiter | Status |
|----------|---------|--------|
| `POST /api/learning/cases` | `WRITE_LIMITER` | ✅ |
| `GET /api/learning/similar-cases` | `READ_LIMITER` | ✅ |
| `GET /api/learning/preferences` | `READ_LIMITER` | ✅ |
| `GET /api/learning/patterns` | `READ_LIMITER` | ✅ |
| `POST /api/telemetry/ai/learning/run` | `READ_LIMITER` (admin only) | ✅ |
| `GET /api/telemetry/ai/knowledge/patterns` | `READ_LIMITER` (admin only) | ✅ |

**Wniosek:** Rate limiting na wszystkich nowych endpointach. ✅

---

## 5. Autoryzacja

| Endpoint | Auth | Admin-only? | Status |
|----------|------|-------------|--------|
| `POST /api/learning/cases` | `requireAuth` | Nie (każdy zalogowany) | ✅ |
| `GET /api/learning/similar-cases` | `requireAuth` | Nie | ✅ |
| `GET /api/learning/preferences` | `requireAuth` | Nie | ✅ |
| `POST /ai/learning/run` | `requireAuth` + role check | Tak | ✅ |
| `GET /ai/knowledge/patterns` | `requireAuth` + role check | Tak | ✅ |

**Wniosek:** Poziomy autoryzacji spójne z resztą projektu.

---

## 6. Podsumowanie

| # | Problem | Plik:linia | Priorytet |
|---|---------|-----------|-----------|
| 1 | Brak runtime walidacji `componentSeq` (oczekiwana tablica) | `learningRoutes.ts:31` — tylko TypeScript cast | **P3** |
| 2 | reszta: XSS, CSP, auth, rate limits | wszystkie | ✅ OK |
