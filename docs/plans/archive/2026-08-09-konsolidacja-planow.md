# Plan: Konsolidacja planów zrealizowanych — analiza pozostałych pozycji

Data: 2026-08-09 | Status: ZREALIZOWANY (kroki F i P3 wdrożone w commitach 19778a5/0542b2b/a4b853f; pozycje 1, 4, 5 świadomie pominięte) | Tryb: wdrożenie po akceptacji

## 1. Cel i tło

Wszystkie plany sprzed 2026-08-09 zostały zweryfikowane w kodzie jako **wdrożone**
i przeniesione do `docs/plans/archive/`. Ten plan konsoliduje jedyne **pozostałe
otwarte pozycje** (deferred/optional/blocked) wyłuskane z tamtych planów i
rekomenduje, co faktycznie warto robić dalej — z oceną, czy są jeszcze potrzebne,
czy istnieje lepsze rozwiązanie na dziś.

## 2. Weryfikacja: co zostało faktycznie wdrożone

| Plan (archiwum)                      | Status w kodzie (potwierdzony grepem/commitem)                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| 2026-08-06-retencja-modeli-ml        | WDROŻONE                                                                              |
| 2026-08-06-spojny-pasek-gorny        | Kroki A–D wdrożone; E pominięty (niska wartość), F wdrożony (commity 19778a5/0542b2b) |
| 2026-08-07-naprawy-ai-ml-dashboard   | WDROŻONE (commit b84b240, testy 1481/1481)                                            |
| 2026-08-07-pierwszy-model-ai-ml      | Faza A wdrożona, Faza B przetestowana; operacyjnie w toku                             |
| 2026-08-08-usprawnienia-modulu-excel | WDROŻONE (commity 9c44d07/e1eb742)                                                    |
| 2026-08-08-zlecenia-wirtualizacja    | Fazy 0–6 wdrożone; 7 zablokowana, 8 opcjonalna                                        |
| 2026-08-09-spojny-styl-index         | WDROŻONE (commit 8de47f8)                                                             |

## 3. Pozostałe otwarte pozycje — ocena aktualności

| #   | Pozycja                                                                                                                                     | Źródło (plan)          | Stan                                       | Ocena dziś                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Krok E** — klasa `.ai-status-badge` w `spa.css` (przeniesienie inline style z `app.html`), usunięcie martwych `.ai-status-online/offline` | pasek-gorny E          | Opcjonalny, tani (~20 linii)               | **Niskiej wartości** — martwe klasy `.ai-status-online/offline` już usunięte (grep = 0); inline style działa i nie migocze (krok B wdrożony). Przeniesienie do klasy = czystość CSS, zero funkcji. **Pominięty.**                                                                                                                                                                                                                                         |
| 2   | **Krok F** — konsolidacja `header-right` do `public/js/shared/headerUser.js`                                                                | pasek-gorny F          | **WDROŻONY (19778a5/0542b2b)**             | **Zrealizowany** — moduł `public/js/shared/headerUser.js` (`window.headerUser.render(user)`) renderuje `#header-username` i `#header-role-badge` we wszystkich wejściówkach; wspólne klasy `.header-user-info`/`.header-username`/`.header-role-badge`/`.header-version`/`.header-logout` w `style.base.css`; usunięto martwe `.dash-*` (index.css) i `.rury-header-*`/`.rury-role-badge`/`.rury-btn-logout` (rury.css) oraz inline style/handlery hover. |
| 3   | **P3** — klasy `nav-accent-builder/offer/pricelist` bez definicji w CSS                                                                     | pasek-gorny P3         | **WDROŻONY (19778a5)**                     | **Zrealizowany** — przypisanie `nav-accent-${s.id}` usunięte z `router.js` oraz atrybuty `nav-accent-*` z `partials/rury/header.html` (grep = 0).                                                                                                                                                                                                                                                                                                         |
| 4   | **Faza 7** — duplikaty PZ w zleceniach                                                                                                      | zlecenia-wirtualizacja | ZABLOKOWANA (brak reguły biznesowej)       | **Nie robić** — semantyka „duplikatu PZ" wymaga decyzji użytkownika. Zostaje w archiwum jako przypis.                                                                                                                                                                                                                                                                                                                                                     |
| 5   | **Faza 8** — grid-swap (pełna wirtualizacja renderera)                                                                                      | zlecenia-wirtualizacja | OPCJONALNA (tylko na żądanie pixel-parity) | **Nie robić** — `MAX_LOADED` + kontener scrolla już rozwiązują jank; utrzymywanie 2 rendererów to anty-wzorzec.                                                                                                                                                                                                                                                                                                                                           |

## 4. Rekomendacja

**ZREALIZOWANE**: pozycje 2 (krok F — `headerUser.js`) i 3 (P3 — martwe `nav-accent-*`)
wdrożone w commitach 19778a5/0542b2b/a4b853f. Uzasadnienie pierwotne (SRP/DRY, jeden
blok HTML w 4+ plikach) potwierdziło się — teraz każda zmiana badge/UI to edycja jednego
modułu (`public/js/shared/headerUser.js`) i wspólnych klas `.header-*` w `style.base.css`.

**POMINIĘTE**: pozycje 1 (krok E — kosmetyka bez zysku), 4 (faza 7 — zablokowana), 5 (faza 8 — anty-wzorzec).

> Uwaga: plan nie zakładał zmian w `?v=` (cache-bust przez release) ani w logice
> funkcjonalnej modułów.

## 5. Zakres zmian — krok implementacyjny

### Krok F — `public/js/shared/headerUser.js` ✅ WDROŻONY (19778a5/0542b2b)

- **Cel (zrealizowany)**: jeden moduł renderujący dane użytkownika w nagłówku (username, badge roli) przez `window.headerUser.render(user)`.
- **Pliki podpięte**: `public/index.html`, `public/app.html`, `public/kartoteka.html`, `public/partials/header.html`, `public/partials/rury/header.html` (+ warianty studni).
- **Realizacja**: `dashboard.js` deleguje do `headerUser.render` (poprawka: rola PRO wyświetlana poprawnie, nie jako USER); wspólne klasy `.header-user-info`/`.header-username`/`.header-role-badge`/`.header-version`/`.header-logout` w `style.base.css`; usunięto martwe `.dash-*` (index.css) i `.rury-header-*`/`.rury-role-badge`/`.rury-btn-logout` (rury.css) oraz inline style/handlery hover (wyloguj bazuje na `.header-logout:hover`).
- **Weryfikacja (wykonana)**: `node -c public/js/shared/headerUser.js`; `npm run lint:frontend`; `npm run format`; ręcznie — wszystkie wejściówki pokazują username/rolę/wyloguj/wersję.

### Krok P3 — usunięcie martwych `nav-accent-*` ✅ WDROŻONY (19778a5)

- **Plik**: `public/js/spa/router.js` + `public/partials/rury/header.html`.
- **Zmiana (wykonana)**: usunięto przypisanie klasy `nav-accent-${s.id}` oraz atrybuty `nav-accent-builder/offer/pricelist` (grep = 0).
- **Priorytet**: niski. **Ryzyko**: zerowe.

## 6. Strategia testów

- `node -c public/js/shared/headerUser.js`
- `npm run lint:frontend`, `npm run format`, `npm run typecheck:frontend`
- `npm run test:quick` (sanity)
- Ręcznie: logowanie, wszystkie moduły (Studnie/Rury/Kartoteka/Zlecenia) — header-right kompletny i spójny.

## 7. Kryteria sukcesu

- [x] `headerUser.js` istnieje i jest podpięty we wszystkich wejściówkach (skrypt w 5 plikach HTML: index/app/kartoteka/rury/studnie.html; `window.headerUser.render(user)` wołany z dashboard.js, app.js, appStudnie.js, router.js, kartotekaInit.js, pricelistInit.js).
- [x] Usunięta duplikacja inline init username/role/logout z `app.html`/`dashboard.js`/`kartoteka.html`.
- [x] Martwe `nav-accent-*` usunięte (grep = 0).
- [x] Brak regresji wizualnej header-right (username, badge roli, wyloguj, badge AI, wersja).
- [x] `npm run validate` zielone; `npm run format` wykonany.
