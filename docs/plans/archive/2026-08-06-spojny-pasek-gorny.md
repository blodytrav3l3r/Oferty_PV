# Plan: Spójny pasek górny SPA — naprawa „przesuwania ikon" między zakładkami

Data: 2026-08-06 | Status: ZREALIZOWANY (kroki A-D wdrożone, E/F poza zakresem) | Tryb: wdrożenie po akceptacji

> Plan finalny po weryfikacji kodu. Wszystkie ustalenia z poprzednich analiz
> potwierdzone w repo — lokalizacje podane w sekcji 2.

## 1. Cel i tło

Podczas przełączania zakładek w `app.html` (Studnie ↔ Rury ↔ Kartoteka) zawartość
paska górnego (logo, kafle nawigacji, prawa strona z badge AI i nazwą użytkownika)
„skacze" w poziomie. Przyczyny:

1. **P1**: `spa.css` kasuje domyślny padding headera tylko dla modułu Studnie
   (klasa `module-studnie` z routera) → pasek edge-to-edge, reszta modułów ma padding.
2. **P2**: badge AI zmienia `display: none` → `inline-flex` po pierwszym pollu oraz
   zmienia szerokość tekstu → przesuwa prawą stronę headera.
3. **P2**: tooltip badge jest nadpisywany przez dwa niezależne skrypty
   (`aiStatusIndicator.js` w app.html i `mlDualRanking.js` w iframe studni) → migotanie.
4. **BUG (backend)**: `/api/telemetry/ai/ml-status` nie zwraca `rankingVersion` →
   tooltip pokazuje `ranking: ?`.

Cel: jeden stabilny pasek górny bez layout shift, jedno źródło prawdy dla badge AI,
poprawna wartość wersji rankingu. Konsolidacja duplikacji header-right (6 plików)
świadomie poza zakresem — osobna iteracja.

## 2. Ustalenia — potwierdzone lokalizacje w repo

| #   | Ustalenie                                     | Lokalizacja (potwierdzona)                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | Nadpisanie paddingu headera dla Studni        | `public/css/spa.css:98-104` (`body.module-studnie .header{padding:0}` / `.header-inner{padding:0.3rem 0}`); klasa ustawiana w `public/js/spa/router.js:297`; bazowy padding: `public/css/style.base.css:382` (`.header{padding:0 1rem}`) i `:396` (`.header-inner{padding:0.3rem 1.5rem}`). Analogiczne nadpisanie w `public/css/studnie.css:38-41` (dotyczy samodzielnej `studnie.html`, header w iframe i tak ukrywany — router.js:239). |
| P2  | Badge `display:none` → `inline-flex` po pollu | `public/app.html:75-104` (badge, inline `display:none` w :78); `public/js/aiStatusIndicator.js:60` (`badge.style.display='inline-flex'`); `public/js/studnie/mlDualRanking.js:879` (`revealAiStatusBadge`). Poll co 30 s: `aiStatusIndicator.js:87`.                                                                                                                                                                                       |
| P2  | Tooltip race                                  | `aiStatusIndicator.js:38-52` pisze `text.title` (własny format, bez „Kliknij Auto"); `mlDualRanking.js:936` pisze `text.title = title + '\nKliknij Auto...'`; `mlDualRanking.js:968-982` (`fetchLearningStatusAsync`) dokleja linię „Wzorce AI..." do `existing.split('\n')[0]`. Oba działają na tym samym elemencie w dokumencie rodzica (`getAiStatusElements`, mlDualRanking.js:858-870).                                               |
| P2  | Backend nie zwraca `rankingVersion`           | `src/routes/telemetryAiMl.ts:390-407` (odpowiedź `/ai/ml-status` — jest `featureVersion`, brak `rankingVersion`). `src/config/mlConstants.ts:28-34` (`ML_CONSTANTS`) — brak stałej; frontend ma lokalną stałą `RANKING_VERSION = 'dual_v1'` (`mlDualRanking.js:37`), używaną też w telemetrii (linie 599, 660, 809).                                                                                                                       |
| P3  | Klasy `nav-accent-*` niezdefiniowane          | `public/js/spa/router.js:117` (`nav-accent-${s.id}`), `public/partials/rury/header.html:50,58,66` (`nav-accent-builder/offer/pricelist`); brak jakiejkolwiek definicji w `*.css` (grep — 0 wyników).                                                                                                                                                                                                                                       |
| —   | Martwe klasy badge                            | `public/css/index.css:1444-1453` `.ai-status-online` / `.ai-status-offline` — brak użyć w JS/HTML (grep — 0 wyników).                                                                                                                                                                                                                                                                                                                      |
| —   | Duplikacja header-right                       | `public/app.html:70-120`, `public/kartoteka.html:65`, `public/partials/header.html:83`, `public/partials/rury/header.html:77` (+ warianty studni) — osobna iteracja (krok F).                                                                                                                                                                                                                                                              |

Dodatkowo potwierdzone:

- `public/js/aiStatusIndicator.js` jest załadowany w `app.html:181` (badge działa globalnie, niezależnie od iframe).
- `getMlStatus` / `updateAiStatusIndicator` / `revealAiStatusBadge` mają wyłącznie wewnętrznych callerów w `mlDualRanking.js` (window exports 1018/1023 nieużywane nigdzie indziej — grep całego `public/` i `src/`).
- `src/routes/telemetryAiMl.ts:15` już importuje `ML_CONSTANTS`.
- W working tree są niezacommitowane zmiany (`aiStatusIndicator.js` nowy/untracked, `mlDualRanking.js` i `telemetryAiMl.ts` zmodyfikowane) — plan buduje na tym stanie.

## 3. Decyzje projektowe

| Decyzja                   | Wybór                                                                                                                                                                                                 | Uzasadnienie                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A: padding headera**    | Usunąć nadpisania `module-studnie` ze `spa.css` (przywrócić bazowy padding ze `style.base.css`)                                                                                                       | Minimalna zmiana (2 reguły mniej), przywraca jeden spójny layout we wszystkich modułach. Alternatywa (ujednolicenie do edge-to-edge we wszystkich modułach) wymagałaby klasy `module-rury`/`module-kartoteka` i większego diffa — niepotrzebne.                                                                                                                                                                                        |
| **B: layout shift badge** | `visibility: hidden` zamiast `display: none` + `min-width` na tekście                                                                                                                                 | `display:none` usuwa element z layoutu — pojawienie badge po pollu przesuwa prawą stronę; `visibility` zachowuje zajmowane miejsce (zero skoku). `min-width` stabilizuje krótkie warianty tekstu („AI Offline" vs „AI 45% · v6 · data"). Kompromis: pusty obrys (pill) widoczny zanim backend odpowie — akceptowalne, niezmienny layout jest ważniejszy.                                                                               |
| **C: tooltip race**       | `aiStatusIndicator.js` jest JEDYNYM właścicielem badge; `mlDualRanking.js` przestaje dotykać badge (usunięcie bloku „WSKAŹNIK AI W UI"), logika „Wzorce AI..." przeniesiona do `aiStatusIndicator.js` | Badge żyje w app.html; aiStatusIndicator działa globalnie (też poza modułem studni) i ma już poll 30 s na ten sam endpoint. Usunięcie z iframe eliminuje race u źródła (SRP). Linia „Kliknij Auto, aby uruchomić solver z AI rankingiem" NIE jest przenoszona — to wskazówka kontekstowa solvera studni, a badge jest globalny (myląca w Rurach/Kartotece); decyzja produktowa, łatwa do odwrócenia (stała linia w aiStatusIndicator). |
| **D: rankingVersion**     | Dodać stałą `RANKING_VERSION` do `ML_CONSTANTS` (backend) + pole w `/ai/ml-status`                                                                                                                    | Backend staje się źródłem prawdy (wzorzec jak `FEATURE_VERSION`); frontend przestaje zgadywać (koniec `ranking: ?`). Wartość domyślna `'dual_v1'` zgodna z obecną stałą frontendową.                                                                                                                                                                                                                                                   |
| **E: klasa CSS badge**    | Przenieść inline style badge do klasy `.ai-status-badge` w `spa.css`, usunąć martwe `.ai-status-online/offline`                                                                                       | Czystość (SRP CSS/HTML), miejsce na `min-width`/`.is-visible`; tani, opcjonalny.                                                                                                                                                                                                                                                                                                                                                       |
| **F: headerUser.js**      | Osobna iteracja (POZA tym taskiem)                                                                                                                                                                    | Przebudowa 4–6 plików z header-right; nie blokuje naprawy przesuwania.                                                                                                                                                                                                                                                                                                                                                                 |

## 4. Zakres zmian — kroki implementacyjne

### Krok A — fix P1: spójny padding headera (TERAZ)

- **Plik**: `public/css/spa.css`
- **Zmiana**: usunąć linie **98–104** (komentarz `/* Moduł Studnie — header edge-to-edge */` + `body.module-studnie .header { padding: 0; }` + `body.module-studnie .header-inner { padding: 0.3rem 0; }`).
- **Dlaczego**: te reguły kasują padding bazowy (`style.base.css:382,396`) tylko dla modułu Studnie → skok zawartości paska przy przełączaniu zakładek. Po usunięciu wszystkie moduły używają wspólnego paddingu `0 1rem` / `0.3rem 1.5rem`.
- **Priorytet**: wysoki (główna przyczyna). **Ryzyko**: niskie.
- **Uwaga**: `studnie.css:38-41` pozostaje bez zmian (dotyczy samodzielnej `studnie.html` poza SPA; w iframe header i tak ukrywany przez `router.js:239`).
- **Weryfikacja**: `npm run format`; ręcznie w przeglądarce — przełączenie Studnie ↔ Rury ↔ Kartoteka, logo/kafle nie zmieniają pozycji.

### Krok B — fix P2: layout shift badge (TERAZ, po kroku C)

- **Decyzja**: `visibility: hidden` (zamiast `display: none`) + `min-width` na `#ai-status-text`.
- **Pliki i zmiany**:
    - `public/app.html:78` — w inline style `#ai-status-indicator` zamienić `display: none;` na `visibility: hidden;`.
    - `public/app.html:103` — `#ai-status-text` dodać inline `style="min-width: 13ch; display: inline-block;"` (jeśli krok E wykonywany — tam do CSS).
    - `public/js/aiStatusIndicator.js:60` — `badge.style.display = 'inline-flex';` → `badge.style.visibility = 'visible';`.
    - (Jeśli krok C wykonany przed B — to jedyne zmiany JS; w przeciwnym razie analogicznie `mlDualRanking.js:879` → `indicator.style.visibility = 'visible'`, ale krok C i tak to usuwa.)
- **Priorytet**: wysoki (widoczny shift przy starcie i po pollu). **Ryzyko**: niskie.
- **Weryfikacja**: `node -c public/js/aiStatusIndicator.js`; `npm run lint:frontend`; `npm run format`; ręcznie — po zalogowaniu i po 30 s pollu prawa strona headera nie drga.

### Krok C — fix P2: tooltip race, jedno źródło prawdy (TERAZ)

- **Decyzja**: właścicielem badge jest `aiStatusIndicator.js`; `mlDualRanking.js` przestaje go dotykać.
- **Plik**: `public/js/studnie/mlDualRanking.js`
    - Usunąć wywołanie `updateAiStatusIndicator()` po rankingu (linie **777–780**).
    - W `fetchMlStatusAsync` (818–849) usunąć `revealAiStatusBadge()` + `updateAiStatusIndicator()` (linie **840–841**) — aktualizacja zmiennych stanu (834–839) zostaje.
    - Usunąć cały blok **„WSKAŹNIK AI W UI"** (linie **851–989**): `getAiStatusElements`, `revealAiStatusBadge`, `updateAiStatusIndicator`, `fetchLearningStatusAsync` oraz `getMlStatus` (801–812, używany tylko przez usuwany blok).
    - Usunąć poller AI status (linie **998–999**) i window exports: `window.updateAiStatusIndicator` (1018), `window.getMlStatus` (1023).
    - **Zostaje**: `RANKING_VERSION` (linia 37, używane w telemetrii 599/660/809), `fetchMlStatusAsync` (aktualizacja stanu solvera), `ML_STATUS_URL`, `FEATURE_VERSION`.
- **Plik**: `public/js/aiStatusIndicator.js`
    - Dodać (przeniesione z `mlDualRanking.js:942-989`) pobieranie `/api/telemetry/ai/knowledge/stats` z throttle 60 s i doklejanie do `text.title` linii: `Wzorce AI: N aktywnych, M total`, `Confidence: X%`, `Rekomendacje: a/b zaakc.` — z zachowaniem pierwszej linii tooltipu (`existing.split('\n')[0]`).
    - Format bazowego tooltipu bez zmian (z `rankingVersion` — patrz krok D). Linia „Kliknij Auto..." nie jest dodawana.
- **Priorytet**: średni–wysoki (migotanie tooltipu). **Ryzyko**: średnie — duży, aktywny plik; usuwane funkcje są jednak samodzielne i bez zewnętrznych callerów (potwierdzone grepem).
- **Weryfikacja**: `node -c public/js/studnie/mlDualRanking.js`; `node -c public/js/aiStatusIndicator.js`; `npm run lint:frontend`; `npm run format`; ręcznie — hover na badge: stabilny tooltip bez migotania, z linią „Wzorce AI...".

### Krok D — fix backend: `rankingVersion` w `/ai/ml-status` (TERAZ, pierwszy — wymaga restartu backendu)

- **Plik**: `src/config/mlConstants.ts` (linie 28–34)
    - Dodać do `ML_CONSTANTS`: `RANKING_VERSION: process.env.ML_RANKING_VERSION || 'dual_v1',` (wzorzec jak `FEATURE_VERSION`; `'dual_v1'` = obecna wartość frontendowa `mlDualRanking.js:37`).
- **Plik**: `src/routes/telemetryAiMl.ts` (odpowiedź `/ai/ml-status`, linie 390–407)
    - Dodać po `featureVersion` (linia 396): `rankingVersion: ML_CONSTANTS.RANKING_VERSION,` (import `ML_CONSTANTS` już istnieje — linia 15).
- **Efekt**: `aiStatusIndicator.js:50` pokaże `ranking: dual_v1` zamiast `?`; backend staje się źródłem prawdy.
- **Priorytet**: średni (kosmetyka tooltipu, ale ujednolica wersjonowanie). **Ryzyko**: niskie.
- **Weryfikacja**: `npm run typecheck`; `npm run test:quick`; po restarcie backendu `curl /api/telemetry/ai/ml-status` (z tokenem) — pole `rankingVersion` obecne.

### Krok E — opcjonalny: klasa CSS badge + martwe klasy (PÓŹNIEJ w tej iteracji, tani)

- **Plik**: `public/css/spa.css` — dodać `.ai-status-badge` (przenieść inline style z `app.html:75-104`: display/align-items/gap/padding/border/border-radius/background/font/color/white-space/margin-right + `visibility: hidden` + `min-width` dla `#ai-status-text`), `.ai-status-badge.is-visible { visibility: visible; }`.
- **Plik**: `public/app.html:75-104` — podmienić inline style na `class="ai-status-badge"`.
- **Plik**: `public/js/aiStatusIndicator.js:60` — `badge.style.visibility = 'visible'` → `badge.classList.add('is-visible')`.
- **Plik**: `public/css/index.css:1444-1453` — usunąć martwe `.ai-status-online` / `.ai-status-offline`.
- **Priorytet**: niski. **Ryzyko**: niskie. **Weryfikacja**: `npm run format`; podgląd badge (wygląd bez zmian, brak skoku).

### Krok F — headerUser.js: konsolidacja header-right (PÓŹNIEJ, osobna iteracja)

- Wspólny moduł `public/js/shared/headerUser.js` inicjalizujący header-right (username, rola, wyloguj, wersja, badge AI) przez `data-header-user`; podpięcie w `app.html`, `kartoteka.html`, `partials/header.html`, `partials/rury/header.html` (+ warianty studni).
- **Poza zakresem tego tasku** — wymaga przebudowy wielu plików, nie blokuje naprawy przesuwania.

## 5. Kolejność wdrożenia i zależności

| Kolejność | Krok                 | Zależność                           | Uzasadnienie                                                                                                           |
| --------- | -------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1         | **D** (backend)      | brak                                | Izolowany, wymaga restartu backendu — robimy najpierw, żeby tooltip po kroku C od razu miał poprawny `rankingVersion`. |
| 2         | **C** (tooltip race) | brak (miękko: D przed wdrożeniem C) | Usuwa pisanie badge z iframe — dzięki temu krok B dotyka tylko jednego pliku JS.                                       |
| 3         | **A** (CSS P1)       | brak                                | Niezależny — można równolegle z C.                                                                                     |
| 4         | **B** (layout shift) | C (wykonany)                        | Po C zmiana JS tylko w `aiStatusIndicator.js`.                                                                         |
| 5         | **E** (klasa badge)  | B (wykonany)                        | Przenosi inline zmiany z B do CSS.                                                                                     |
| 6         | **F** (headerUser)   | —                                   | Osobna iteracja, poza taskiem.                                                                                         |

## 6. TERAZ vs PÓŹNIEJ

**TERAZ (minimalny zestaw na ten task)**: kroki **A, B, C, D** — razem likwidują całe „przesuwanie ikon" i migotanie tooltipu.

**PÓŹNIEJ**:

- **E** (klasa badge + martwe klasy) — zalecany w tej samej iteracji (tani, ~20 linii), jeśli czas pozwoli.
- **F** (headerUser.js) — osobna iteracja.
- **P3** (`nav-accent-builder/offer/pricelist` bez stylów) — drobna kosmetyka, można dołączyć do E (dodać reguły akcentu w `spa.css`/`rury.css`); nie wpływa na przesuwanie.

## 7. Strategia testów

- **Składnia JS**: `node -c` dla `aiStatusIndicator.js` i `mlDualRanking.js` (po krokach B/C).
- **Lint**: `npm run lint:frontend` (po B/C/E), `npm run lint` (po D).
- **Typecheck**: `npm run typecheck` (po D).
- **Testy**: `npm run test:quick` (po D, sanity check).
- **Format**: `npm run format` zawsze na końcu (Prettier, spójny diff).
- **Testy ręczne**:
    1. Przełączanie Studnie ↔ Rury ↔ Kartoteka — pasek bez skoku (A).
    2. Start aplikacji i poll 30 s — brak drgania header-right (B).
    3. Hover na badge — stabilny tooltip z `ranking: dual_v1` i linią „Wzorce AI..." (C+D).
    4. Ranking studni (Auto) — działa bez regresji po usunięciu bloku UI (C).

## 8. Ryzyka i mitigacje

| Ryzyko                                                                                                  | Mitigacja                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Usunięcie kodu z `mlDualRanking.js` (C) — aktywny, duży plik (1025 linii), w working tree zmodyfikowany | Usuwane funkcje samodzielne, brak zewnętrznych callerów (potwierdzone grepem `public/` i `src/`); po zmianie `node -c` + `lint:frontend` + ręczny test rankowania; w razie czego commit jest punktem powrotu. |
| `visibility: hidden` zostawia pusty obrys badge przed pierwszą odpowiedzią backendu (B)                 | Świadomy kompromis (brak skoku > pusty pill); w E można dodać delikatne `transition`/`opacity`.                                                                                                               |
| Brak stałej backendowej `RANKING_VERSION` — ryzyko rozjazdu z frontendem                                | `ML_RANKING_VERSION` env z domyślnym `'dual_v1'` (identycznym z obecną stałą frontendową); wzorzec jak `FEATURE_VERSION`.                                                                                     |
| Zmiany w working tree (niezacommitowane) — plan buduje na bieżącym stanie                               | Wdrożenie i commit razem; przed commitem `git status` + `git diff` do wglądu.                                                                                                                                 |

## 9. Kryteria sukcesu

- [ ] Przełączanie Studnie ↔ Rury ↔ Kartoteka: logo i kafle w headerze nie zmieniają pozycji.
- [ ] Badge AI nie powoduje skoku header-right przy starcie ani przy pollu 30 s.
- [ ] Tooltip badge stabilny (bez migotania), zawiera `ranking: dual_v1` (nie `?`) oraz linię „Wzorce AI...".
- [ ] `GET /api/telemetry/ai/ml-status` zwraca `rankingVersion`.
- [ ] `npm run validate` zielone; `node -c` przechodzi dla edytowanych plików JS; `npm run format` wykonany.
