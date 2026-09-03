# AI/ML execution kill-switch — plan implementacji

**Wersja:** 2026-09-03 | **Status:** w realizacji | **Decyzja:** full kill-switch, admin + dashboard

## Cel

Przycisk wł./wył. modułu AI/ML w sekcji „AI / ML Dashboard" (Pulpit admin).
Semantyka: **execution kill-switch** — blokuje wykonywanie operacji AI/ML,
nie blokuje statusów, dashboardu diagnostycznego ani pasywnej telemetrii.

- OFF blokuje NOWE operacje od momentu zapisu flagi; rozpoczęte nie są przerywane.
- Pasywna telemetria (`telemetryAi.ts`: config/event/version/acceptance-full) zostaje ON.
- `wellSolver.js` bez zmian; `mlDualRanking` OFF → `return 0` bez fetcha.

## SSoT flagi

- Klucz `settings`: `feature_ai_ml_enabled`, domyślnie ON (`'"1"'`).
- Auto-heal `upsert` w `src/app.ts` (wzorzec `feature_import_export_enabled`).
- `GET /api/feature-flags` rozszerzony o `ai_ml_enabled` — jedyne źródło stanu UI.
- `PUT /api/feature-flags/ai-ml {enabled: boolean}` — strict zod boolean, `requireAdmin`, audit old→new + actor.

## Backend

1. Nowy `src/middleware/aiMlGuard.ts`: `AI_ML_FLAG_KEY`, `isAiMlEnabled()`, `requireAiMlEnabled` → `503 {error:'disabled'}`.
2. `telemetryAiMl.ts` BLOCK (guard): `POST /ai/predict/batch`, `POST /ai/reward`, `DELETE /ai/models/:id`, `POST /ai/models/:id/activate`, `/promote`, `/approve`, `POST /ai/train`, `POST /ai/rollback`.
3. `telemetryAiDashboard.ts` BLOCK: `POST /ai/learning/run`.
4. OPEN + `aiMlEnabled` w JSON: `GET /ai/settings`, `GET /ai/ml-status`, `GET /ai/health` (reszta odczytów bez zmian).

## Frontend

1. `public/index.html` — przycisk `#ai-ml-toggle-btn` w nagłówku sekcji AI/ML.
2. `aiDashboardCore.js` — wspólny `window.aiMlEnabled()` (cache + fetch `/api/feature-flags`) + `window.aiMlDisabledHtml()`.
3. `dashboard.js` — init toggle (label ON/OFF, `aria-pressed`, confirm, PUT, re-render).
4. `mlHealthDashboard.js` / `aiDashboard.js` — early-return placeholder gdy OFF.
5. `aiStatusIndicator.js` — OFF → szary „AI Wyłączone", skip knowledge fetch.
6. `mlDualRanking.js` — OFF → `return 0` bez fetcha.

## Testy

- `tests/featureFlagsAiMl.test.ts`: GET zawiera `ai_ml_enabled`; PUT 403/400/200 + audit old→new.
- `tests/telemetryAiMlDisabled.test.ts`: BLOCK → 503, OPEN → 200 + `aiMlEnabled:false`.
- Frontend: `node -c` + `typecheck:frontend` + `lint:frontend`.

## Walidacja

`npm run validate` + `npm run format` + `npm run version:check` (bez bump wersji).
