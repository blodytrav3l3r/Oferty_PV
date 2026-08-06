# Analiza modułu AI / ML Dashboard — Błędy i Propozycje Ulepszeń

## Podsumowanie

Moduł AI/ML Dashboard składa się z:

| Warstwa | Pliki | Linie |
|---------|-------|-------|
| Frontend | [aiDashboard.js](file:///i:/GitHub/Oferty_PV/public/js/admin/aiDashboard.js), [mlHealthDashboard.js](file:///i:/GitHub/Oferty_PV/public/js/admin/mlHealthDashboard.js) | ~990 |
| Backend routes | [telemetryAiDashboard.ts](file:///i:/GitHub/Oferty_PV/src/routes/telemetryAiDashboard.ts), [telemetryAiMl.ts](file:///i:/GitHub/Oferty_PV/src/routes/telemetryAiMl.ts) | ~700 |
| Serwisy ML | `ModelRegistry`, `TrainingPipeline`, `SelfEvaluation`, `RewardCalculator`, `AcceptanceModel`, `FeatureExtractor` | ~1350 |
| CSS | [index.css](file:///i:/GitHub/Oferty_PV/public/css/index.css) (sekcja AI L1331-1908) | ~580 |
| Testy | [telemetryAiMl.test.ts](file:///i:/GitHub/Oferty_PV/tests/ml/telemetryAiMl.test.ts) | 501 |

**Ogólna ocena**: Moduł jest solidnie zbudowany — ma dobre zabezpieczenia (reward farming, dedup, FEATURE_VERSION_MISMATCH, auto-rollback), kompletne testy backendu, konsekwentne `escapeHtml`. Nie ma błędów blokujących działanie. Znalezione problemy to głównie **potencjalne edge-case'y i usprawnienia architektoniczne**.

---

## 🔴 Znalezione Błędy (do naprawy)

### B1. Race condition w `ModelRegistry.saveModel()` — aktywacja modelu

**Plik**: [ModelRegistry.ts:85-93](file:///i:/GitHub/Oferty_PV/src/services/ml/ModelRegistry.ts#L85-L93)

Metoda `saveModel()` najpierw tworzy nowy model z `active: true`, a **dopiero potem** szuka i dezaktywuje poprzedni. W wyścigu (dwa równoczesne treningi) mogą istnieć dwa aktywne modele jednocześnie. `TrainingPipeline` ma mutex, ale `saveModel` jest public.

```diff
 // Obecny kod (zły porządek):
 await prisma.aiModel.create({ data: { ... active: shouldActivate } });
 if (shouldActivate) {
     const existing = await prisma.aiModel.findFirst({ where: { active: true } });
     // ❌ W tym momencie mogą być 2 aktywne modele
     if (existing) await prisma.aiModel.update({ ... active: false });
 }

 // Poprawka: użycie $transaction
+await prisma.$transaction(async (tx) => {
+    if (shouldActivate) {
+        await tx.aiModel.updateMany({ where: { active: true }, data: { active: false } });
+    }
+    await tx.aiModel.create({ data: { ... active: shouldActivate } });
+});
```

**Ważność**: Średnia (mutex w TrainingPipeline łagodzi ryzyko, ale `saveModel` jest publiczny).

---

### B2. Brakująca obsługa błędu odpowiedzi API `{error}` w `renderStats()`

**Plik**: [aiDashboard.js:102-107](file:///i:/GitHub/Oferty_PV/public/js/admin/aiDashboard.js#L102-L107)

`renderStats()` sprawdza `if (!stats)`, ale nie sprawdza `stats.error`. Jeśli backend zwróci `{ error: 'forbidden' }` lub `{ error: 'server' }`, obiekt jest truthy i kod próbuje odczytać `stats.total`, `stats.active` itd. — wyświetlając `undefined` w kartach.

Porównanie: `renderFeatureImportance()` (linia 684) poprawnie sprawdza `data.error`. Tu brakuje analogicznej logiki.

**Ważność**: Niska (admin zawsze ma dostęp, ale guard powinien być spójny).

---

### B3. Brakująca obsługa błędu w `renderPatterns()` — brak sprawdzenia `data.error`

**Plik**: [aiDashboard.js:200-205](file:///i:/GitHub/Oferty_PV/public/js/admin/aiDashboard.js#L200-L205)

Analogicznie do B2 — `renderPatterns()` nie sprawdza `data.error`, co może prowadzić do próby odczytu `data.items` na obiekcie `{error: 'forbidden'}`.

---

### B4. Nieobsłużony Promise rejection w event handlerach

**Plik**: [aiDashboard.js:595-619](file:///i:/GitHub/Oferty_PV/public/js/admin/aiDashboard.js#L595-L619)

Przycisk treningu ML: jeśli `fetchJson(ENDPOINTS.train)` zwróci Promise, a `.then()` wewnątrz rzuci wyjątek, nie ma `.catch()`. W nowoczesnych przeglądarkach to daje `Unhandled Promise Rejection` w konsoli.

Dotyczy też: Learning Cycle (linia 784-808), Rollback (linia 635-662).

**Ważność**: Niska (nie blokuje UX, ale zaśmieca konsolę).

---

### B5. Typo w tekście: "Wzorce łacznie" → "łącznie"

**Plik**: [aiDashboard.js:111](file:///i:/GitHub/Oferty_PV/public/js/admin/aiDashboard.js#L111)

Drobny literówka w etykiecie karty statystycznej.

---

## 🟡 Potencjalne Problemy (edge-case / code-smell)

### P1. Duplikacja `fetchJson()` — 2 różne implementacje

`aiDashboard.js:17-33` definiuje `fetchJson(url, options)` wspierający opcje (POST, body), a `mlHealthDashboard.js:6-16` definiuje oddzielną `fetchJson(url)` — tylko GET.

Obie funkcje robią to samo (fetch + error handling). To naruszenie DRY. Można wydzielić wspólny helper w `shared/` i rejestrować na `window`.

---

### P2. Brak loading state / spinner w sekcjach dashboardu

`renderStats()`, `renderPatterns()`, `renderFeatureImportance()` nie pokazują stanu ładowania — kontener jest pusty podczas fetch. `mlHealthDashboard.js` poprawnie wstawia tekst "Ladowanie..." (linia 83-84).

---

### P3. `settings POST` nie wysyła klucza `key` — backend hardkoduje `wells_ai_influence`

**Plik**: [aiDashboard.js:492-502](file:///i:/GitHub/Oferty_PV/public/js/admin/aiDashboard.js#L492-L502) vs [telemetryAiMl.ts:348-370](file:///i:/GitHub/Oferty_PV/src/routes/telemetryAiMl.ts#L348-L370)

Frontend wysyła `{ value: val }`, backend `POST /ai/settings` hardkoduje klucz `wells_ai_influence`. Działa poprawnie, ale jeśli kiedyś pojawią się inne ustawienia AI, endpoint nie będzie reużywalny. Nie jest to bug.

---

### P4. Brak `WRITE_LIMITER` na `POST /ai/settings`

**Plik**: [telemetryAiMl.ts:348](file:///i:/GitHub/Oferty_PV/src/routes/telemetryAiMl.ts#L348)

Endpoint `POST /ai/settings` nie ma rate limitera — w odróżnieniu od wszystkich innych POST-ów. `requireAdmin` ogranicza dostęp, ale rate limit chroni też przed przypadkowym spamem.

---

### P5. Brak testów dla endpointów dashboardu KB

**Plik**: [telemetryAiDashboard.ts](file:///i:/GitHub/Oferty_PV/src/routes/telemetryAiDashboard.ts)

Endpointy `/ai/knowledge/stats`, `/ai/knowledge/patterns`, `/ai/learning/run` nie mają testów jednostkowych. `telemetryAiMl.test.ts` pokrywa tylko ML route.

---

### P6. Dwa event listenery `click` na `modelTableWrap` zamiast jednego

**Plik**: [aiDashboard.js:514-592](file:///i:/GitHub/Oferty_PV/public/js/admin/aiDashboard.js#L514-L592)

Podpięto dwa osobne `addEventListener('click', ...)` na ten sam element — jeden dla `delete`, drugi dla `activate`. Lepiej złączyć w jeden delegowany handler.

---

## 🟢 Propozycje Ulepszeń

### U1. Auto-refresh dashboardu co 60s

Dashboard jest czysto statyczny — dane ładowane raz. Po uruchomieniu treningu/rollbacku poszczególne sekcje się odświeżają, ale gdyby inny admin uruchomił trening, dane nie zaktualizują się. Dodanie opcjonalnego auto-refresh (np. `setInterval`) poprawiłoby UX.

---

### U2. Potwierdzenie sukcesu slidera AI Influence

Slider AI Influence po zapisie pokazuje toast (`showToast`), ale nie obsługuje błędu odpowiedzi z serwera (`.then(function() {...})` — brak `.catch` ani sprawdzenia `result.error`). Warto dodać obsługę błędu.

---

### U3. Wyświetlanie `featureVersion` aktywnego modelu w sekcji ML Status

Backend zwraca `featureVersion` w `/ai/ml-status`, ale frontend tego nie wyświetla. Przy wielu wersjach cech to przydatna informacja diagnostyczna.

---

### U4. Wskaźnik postępu sliding AUC w dashboardzie

`SelfEvaluation` zbiera sliding window predykcji i liczy AUC. Byłoby wartościowe wyświetlać aktualny `slidingAuc` i rozmiar okna w dashboardzie — żeby admin widział, czy model zmierza ku auto-rollbackowi.

---

### U5. Animacja przejścia po załadowaniu danych

Sekcje dashboardu pojawiają się natychmiast (innerHTML swap). Dodanie `fade-in` animacji CSS poprawiłoby wrażenie płynności.

---

### U6. Testy E2E / integracyjne frontendu

`tests/responsive/dashboard.test.ts` sprawdza tylko obecność reguł CSS. Brak testów renderowania aiDashboard (np. z mockowanym API) ani interakcji (klik trening, rollback).

---

## Weryfikacja poprawności

### ✅ Co działa dobrze

| Aspekt | Status | Szczegóły |
|--------|--------|-----------|
| Routing (backend) | ✅ OK | Wszystkie 4 pliki route poprawnie zamontowane na `/api/telemetry` w [app.ts:246-253](file:///i:/GitHub/Oferty_PV/src/app.ts#L246-L253) |
| Auth + Admin guard | ✅ OK | `requireAuth` + `requireAdmin` na wszystkich endpointach dashboard |
| XSS prevention | ✅ OK | Konsekwentne `window.escapeHtml()` we wszystkich interpolacjach HTML |
| Lucide icons | ✅ OK | `lucide.createIcons({root: container})` po każdym innerHTML |
| Feature version check | ✅ OK | Predict/batch reject FEATURE_VERSION_MISMATCH + model activation guard |
| Reward anti-poisoning | ✅ OK | Dedup per (wellId, action) + WELL_NOT_FOUND check |
| Auto-rollback (SelfEvaluation) | ✅ OK | Sliding AUC < threshold → auto-rollback z czyszczeniem window |
| Cache prediction | ✅ OK | TTL + max size + klucz oparty o features+context |
| Training mutex | ✅ OK | Mutex z 5min timeout zabezpiecza przed równoległym treningiem |
| CSS responsywność | ✅ OK | 3 breakpoints (desktop 7col, tablet 2col, mobile 1col) |

### ✅ Pokrycie testami backendu

| Endpoint | Testy |
|----------|-------|
| `POST /ai/predict` | ✅ 4 testy (happy path, version mismatch, wrong count, no model) |
| `POST /ai/predict/batch` | ✅ 3 testy (multi, cache, feature mismatch) |
| `POST /ai/reward` | ✅ 4 testy (anti-farming, score range, wellId required, dedup) |
| `GET /ai/feature-importance` | ✅ 2 testy (happy path, no model) |
| `GET /ai/health` | ✅ 4 testy (online, offline, drift=0, drift>0) |
| `GET /ai/knowledge/*` | ❌ Brak testów |
| `POST /ai/learning/run` | ❌ Brak testów |

---

## Open Questions

> [!IMPORTANT]
> **Które z powyższych poprawek chcesz wdrożyć?** Proponuję priorytetyzację:
> 1. **B1** (race condition saveModel) — najważniejszy bug architektoniczny
> 2. **B2+B3** (sprawdzenie `error` w renderStats/renderPatterns) — szybka poprawka
> 3. **B5** (literówka) — trywialny fix
> 4. **P6** (merge event listenerów) — cleanup
> 5. **U2** (obsługa błędu slidera) — UX

> [!NOTE]
> Opcjonalnie mogę też:
> - Dodać testy dla endpointów Knowledge Base (**P5**)
> - Wydzielić wspólny `fetchJson` do `shared/` (**P1**)
> - Dodać loading state / fade-in (**P2, U5**)
