# Plan: CSP nonce (`'unsafe-inline'` → nonce-based)

**Status:** PLAN (do wykonania w innym terminie)
**Utworzono:** 2026-07-22
**Szacowany czas:** ~20-36h (full) / ~3h (Faza 1)

---

## 1. Cel

Zastąpienie `'unsafe-inline'` w Content-Security-Policy mechanizmem nonce w celu zamknięcia luki XSS — nawet przy w pełni działającym `escapeHtml()`, `'unsafe-inline'` pozwala na wykonanie dowolnego kodu w przestrzeni CSP.

**Obecna konfiguracja** (`src/app.ts:108-114`):
```ts
scriptSrc: ["'self'", "'unsafe-inline'"],
scriptSrcAttr: ["'unsafe-inline'"],
styleSrc: ["'self'", "'unsafe-inline'"],
```

---

## 2. Scope

### Wchodzi
- 26 plików HTML z inline event handlerami (~167 onclick/onchange/onsubmit)
- Express Helmet CSP config (`src/app.ts`)
- 15+ partial HTML w `public/partials/` (ładowane dynamicznie przez `partialLoader.js`)
- Vanilla JS w `public/js/` — `innerHTML` z event handlerami

### Nie wchodzi
- `public/templates/` (PDF templates, używane przez Puppeteer — poza CSP przeglądarki)
- `public/js/shared/xlsx.full.min.js` (biblioteka zewnętrzna, nie modyfikujemy)
- Backend TypeScript (`src/`) — CSP dotyczy tylko frontendu
- Istniejące `escapeHtml()` — zostaje jako defense-in-depth

---

## 3. Inwentaryzacja

### 3.1 Pliki HTML z inline handlerami

| Plik | Liczba inline handlerów | Priorytet |
|------|------------------------|-----------|
| `public/partials/studnie/step3-offer.html` | 27 | P1 |
| `public/partials/studnie/modals.html` | 18 | P1 |
| `public/partials/studnie/pricelist.html` | 17 | P1 |
| `public/partials/studnie/sidebar.html` | 16 | P1 |
| `public/kartoteka.html` | 9 | P2 |
| `public/studnie.html` | 8 | P1 |
| `public/index.html` | 8 | P2 |
| `public/partials/studnie/offer.html` | 7 | P1 |
| `public/zlecenia.html` | 7 | P2 |
| `public/partials/studnie/step1-client.html` | 5 | P2 |
| `public/partials/studnie/step2-parameters.html` | 5 | P2 |
| `public/partials/studnie/step4-build-card.html` | 6 | P2 |
| `public/partials/studnie/wizard-nav.html` | 5 | P2 |
| `public/partials/studnie/summary-bar.html` | 5 | P2 |
| `public/partials/rury/pricelist.html` | 5 | P2 |
| `public/partials/studnie/transport-modal.html` | 4 | P2 |
| `public/partials/studnie/header.html` | 4 | P2 |
| `public/partials/rury/step3-offer-summary.html` | 3 | P2 |
| `public/partials/rury/step2-products.html` | 3 | P2 |
| `public/partials/rury/offer.html` | 3 | P2 |
| `public/partials/rury/step5-order.html` | 2 | P3 |
| `public/rury.html` | 2 | P3 |
| `public/partials/studnie/header.html` (2) | 1 | P3 |
| `public/app.html` | 1 | P1 |
| `public/partials/rury/wizard-nav.html` | 3 | P2 |
| Pozostałe | ~5 | P3 |

### 3.2 Wzorce inline handlerów

| Wzorzec | Przykład | Ilość | Strategia |
|---------|----------|-------|-----------|
| Prosta funkcja globalna | `onclick="appLogout()"` | ~60 | `addEventListener('click', appLogout)` |
| Z argumentem (number) | `onclick="addNewWell(1000)"` | ~40 | `el.dataset.dn='1000'` + listener z `dataset.dn` |
| Z argumentem (string) | `onclick="filterByType('all')"` | ~30 | `el.dataset.type='all'` + listener z `dataset.type` |
| Z `this` | `onclick="this.select()"` | ~15 | `el.addEventListener('click', (e) => e.target.select())` |
| onchange | `onchange="validateWizardStep2()"` | ~12 | `addEventListener('change', validateWizardStep2)` |
| onsubmit | `onsubmit="..."` | ~5 | `addEventListener('submit', ...)` |
| Inne (onerror, onload) | `onerror="..."` | ~5 | `addEventListener('error', ...)` |

### 3.3 Sposób serwowania HTML

Wszystkie pliki HTML serwowane przez `express.static` (`src/app.ts:141-165`):
```ts
express.static(path.join(process.cwd(), 'public'), {
    index: 'index.html',
    extensions: ['html']
})
```

**Problem:** `express.static` serwuje plik z dysku bez transformacji. Nie ma hooka do wstrzyknięcia nonce.

---

## 4. Strategia

### Rekomendacja: Nonce + event delegation (Fazy 1-4)

**Uzasadnienie:**
- **Nonce** (nie hash) — hash jest deterministiczny i wymaga przebudowy `script-src` przy każdej zmianie inline skryptu. Przy 31 plikach HTML i ~167 handlerach, hash byłby koszmarem utrzymaniowym. Nonce jest dynamiczny i nie wymaga zmiany configu po wdrożeniu.
- **Event delegation** (nie addEventListener per element) — dla dynamicznych partiali ładowanych przez `partialLoader.js`, event delegation na rodzicu to ~20 linii kodu vs modyfikacja każdego partiala osobno.

### Alternatywa: Hash + 'strict-dynamic'

Hash pozwala ominąć problem `express.static` (nie trzeba serwować HTML dynamicznie), ale:
- Wymaga hashowania każdego inline `<script>` bloku
- Nie rozwiązuje problemu inline onclick (one i tak muszą być wyeliminowane)
- Każda zmiana inline skryptu wymaga przebudowy hashy
- Działa tylko jeśli wszystkie `<script>` są inline (nie ze źródeł zewnętrznych)

**Decyzja:** Nonce → wymaga zmiany serwowania HTML, ale jest bardziej elastyczny w utrzymaniu.

---

## 5. Fazy implementacji

### Faza 1: Nonce middleware + CSP-Report-Only (~3h)

**Cel:** Uruchomić monitorowanie violacji bez łamania funkcjonalności.

**Zadania:**
1.1. Dodać middleware generujący nonce per request (`crypto.randomBytes(16).toString('base64')`) i zapisujący w `res.locals.cspNonce`
1.2. Skonfigurować Helmet na callbacki dla `scriptSrc`:
   ```ts
   scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`]
   ```
1.3. Zmienić `express.static` dla HTML na dynamiczny route:
   ```ts
   app.get('/*.html', (req, res) => {
     const filePath = path.join(process.cwd(), 'public', req.path);
     let html = fs.readFileSync(filePath, 'utf-8');
     html = html.replace(/__CSP_NONCE__/g, res.locals.cspNonce);
     res.type('html').send(html);
   });
   ```
1.4. Dodać `nonce="__CSP_NONCE__"` do wszystkich `<script>` tagów w 31 plikach HTML (wyszukiwanie regex: `<script\b` → `<script nonce="__CSP_NONCE__"`)
1.5. Włączyć CSP-Report-Only równolegle z obecnym `'unsafe-inline'`:
   - Zachować `scriptSrc: ["'self'", "'unsafe-inline'"]` (enforce)
   - Dodać osobny nagłówek `Content-Security-Policy-Report-Only` z nonce
1.6. Zweryfikować: otworzyć każdy moduł, sprawdzić konsolę浏 w Chrome DevTools (zakładka Issues)

**Pliki do zmiany:**
- `src/app.ts` — middleware, route, Helmet config
- Wszystkie 31 plików HTML — dodanie `nonce="__CSP_NONCE__"` do `<script>` tagów

**Ryzyko:** Niskie — Report-Only nie blokuje niczego, tylko raportuje.
**Rollback:** Usunąć middleware i route, przywrócić `express.static`.

---

### Faza 2: Migracja inline onclick → event delegation (~12h)

**Cel:** Wyeliminować wszystkie inline event handlery w HTML.

**Zadania:**

2.1. **Dodać globalną event delegation** w `public/js/shared/ui.js` lub nowym pliku `public/js/shared/cspDelegate.js`:
   - Listener na `document.body` dla kliknięć, change, submit
   - Odczyt `dataset.action` z `event.target.closest('[data-action]')`
   - Mapowanie `data-action` → funkcja

2.2. **Migracja P1 (4h):** Pliki z największą liczbą handlerów:
   - `partials/studnie/step3-offer.html` (27) → nadaj `data-action="..."`, usuń `onclick`
   - `partials/studnie/modals.html` (18) → j.w.
   - `partials/studnie/pricelist.html` (17) → j.w.
   - `partials/studnie/sidebar.html` (16) → j.w.
   - `studnie.html` (8) → j.w.
   - `partials/studnie/offer.html` (7) → j.w.

2.3. **Migracja P2 (5h):** Pliki średnie:
   - `kartoteka.html` (9), `zlecenia.html` (7), `index.html` (8)
   - `partials/studnie/step1-client.html` (5), `step2-parameters.html` (5), `step4-build-card.html` (6)
   - `partials/studnie/wizard-nav.html` (5), `summary-bar.html` (5)
   - `partials/rury/pricelist.html` (5), `transport-modal.html` (4), `header.html` (4)
   - `partials/rury/*.html` (~15)

2.4. **Migracja P3 (3h):** Pozostałe:
   - `rury.html` (2), `app.html` (1)
   - `partials/rury/wizard-nav.html` (3)
   - Wszystkie pozostałe drobne partiale

**Wzorzec migracji:**
```html
<!-- PRZED -->
<button onclick="addNewWell(1000)" class="btn">Dodaj 1000</button>

<!-- PO -->
<button data-action="add-well" data-dn="1000" class="btn">Dodaj 1000</button>
```

```js
// W cspDelegate.js
document.body.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (action === 'add-well') window.addNewWell(parseInt(el.dataset.dn));
  if (action === 'logout') window.appLogout();
  if (action === 'filter-type') window.filterByType(el.dataset.type);
  // ...mapowanie dla każdej akcji
});
```

**Weryfiacja:** `node -c` dla każdego zmienionego pliku JS. Ręczne testowanie każdego modułu.

**Ryzyko:** Średnie — źle zmapowana delegacja może złamać funkcjonalność. Każdy moduł trzeba ręcznie przetestować.

---

### Faza 3: Obsługa dynamicznego innerHTML (~2h)

**Cel:** Obsłużyć event handlery w dynamicznie tworzonym HTML przez JS.

**Problem:** Gdy JS robi `container.innerHTML = '<button data-action="...">Klik</button>'`, nowy element nie ma listenera — delegacja na rodzicu już go złapie, o ile `data-action` został nadany.

**Zadania:**
3.1. Przejrzeć `public/js/` pod kątem `innerHTML` z event handlerami inline (np. `` innerHTML = `<td onclick="...">` ``)
3.2. Zastąpić wszystkie inline onclick w template stringach atrybutem `data-action`
3.3. Tam gdzie nie ma rodzica z delegacją, dodać post-processing po `innerHTML`:
   ```js
   container.innerHTML = html;
   container.querySelectorAll('[data-action]').forEach(el => {
     // listener już obsłużony przez delegację, nic nie trzeba
   });
   ```
3.4. Sprawdzić `lucide.createIcons({root: container})` — działa bez zmian (nie tworzy inline event handlerów)

**Weryfiacja:** `node -c public/js/**/*.js`

**Ryzyko:** Niskie-średnie — może wymagać modyfikacji wielu plików JS.

---

### Faza 4: Włączenie strict CSP (~1h)

**Cel:** Wyłączyć `'unsafe-inline'` i przejść na nonce-based CSP w trybie enforce.

**Zadania:**
4.1. Usunąć `'unsafe-inline'` z `scriptSrc` i `scriptSrcAttr` w Helmet config
4.2. Zostawić `nonce` w `scriptSrc` (już skonfigurowane w Fazie 1)
4.3. Dodać `'strict-dynamic'` dla wsparcia ładowania skryptów przez trusted scripts
4.4. Usunąć CSP-Report-Only (lub zostawić jako monitoring)
4.5. Przetestować wszystkie moduły produkcyjnie

**Weryfiacja:** Brak violacji w konsoli, działające wszystkie moduły.

**Ryzyko:** Wysokie — jeśli Faza 2 lub 3 niekompletna, mogą być zablokowane funkcje.

---

### Faza 5: Monitoring (ongoing)

**Cel:** Wykrywać regresje CSP w produkcji.

**Zadania:**
5.1. Zostawić CSP-Report-Only endpoint zbierający raporty violacji
5.2. Opcjonalnie: dodać `report-uri` lub `report-to` dyrektywę
5.3. Co tydzień przeglądać raporty violacji

---

## 6. Podsumowanie czasowe

| Faza | Opis | Czas | Zależności |
|------|------|------|-----------|
| 1 | Nonce middleware + Report-Only | ~3h | — |
| 2 | Migracja onclick → event delegation | ~12h | Faza 1 |
| 3 | Obsługa innerHTML | ~2h | Faza 2 |
| 4 | Włączenie strict CSP | ~1h | Fazy 1-3 |
| 5 | Monitoring | ~1h | Faza 4 |
| **Razem** | | **~19h** | |

---

## 7. Ryzyka i mitigacje

| Ryzyko | Prawdopod. | Wpływ | Mitigacja |
|--------|-----------|-------|-----------|
| Faza 2 niekompletna → zablokowane funkcje w Fazie 4 | Średnie | Wysoki | Faza 1 (Report-Only) wykryje violacje przed enforce |
| Duplikacja ID w HTML po dodaniu `id` dla listenerów | Niskie | Średni | Używać `data-action` zamiast `id` |
| `this` w handlerach (np. `this.select()`) straci kontekst | Średnie | Średni | Użyć `event.target` zamiast `this` |
| Regresja w rzadko używanych modułach | Niskie | Wysoki | Testy manualne wszystkich modułów przed Fazą 4 |
| partialLoader ładuje HTML z internetu → CSP i tak blokuje | Niskie | Niski | Partiale są lokalne, nie zewnętrzne |

---

## 8. Kryteria sukcesu

1. **Zero violacji** w CSP-Report-Only przez 7 dni po Fazie 1
2. **Wszystkie moduły działają** po Fazie 2 (test manualny każdego przycisku)
3. **Zero naruszeń** w konsoli po włączeniu enforce (Faza 4)
4. **`'unsafe-inline'` usunięte** z `scriptSrc` i `scriptSrcAttr`

---

## 9. Go/No-Go

**Go:** Wykonać Fazę 1 (3h) — daje monitoring bez ryzyka. Decyzja o Fazach 2-4 po analizie raportów violacji.

**No-Go:** Całość odłożona do refaktora UI (plan: Vanilla JS → framework). Wtedy CSP nonce będzie naturalną częścią nowej architektury.

---

## 10. Słownik

| Pojęcie | Opis |
|---------|------|
| **CSP** | Content Security Policy — nagłówek HTTP ograniczający źródła skryptów/stylów |
| **Nonce** | Jednorazowy token (number-used-once) — losowa wartość generowana per request |
| **`'unsafe-inline'`** | Dyrektywa CSP zezwalająca na wszystkie inline skrypty (luka bezpieczeństwa) |
| **`'strict-dynamic'`** | Dyrektywa CSP — zaufany skrypt może ładować kolejne skrypty |
| **Report-Only** | Tryb CSP, który raportuje violacje bez blokowania |
| **Event delegation** | Wzorzec: jeden listener na rodzicu zamiast N listenerów na dzieciach |
| **`data-action`** | Atrybut HTML zastępujący `onclick` — zawiera nazwę akcji do wywołania |
