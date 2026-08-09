# Plan: Konsolidacja planów zrealizowanych — analiza pozostałych pozycji

Data: 2026-08-09 | Status: DO WDROŻENIA (plan read-only) | Tryb: wdrożenie po akceptacji

## 1. Cel i tło

Wszystkie plany sprzed 2026-08-09 zostały zweryfikowane w kodzie jako **wdrożone**
i przeniesione do `docs/plans/archive/`. Ten plan konsoliduje jedyne **pozostałe
otwarte pozycje** (deferred/optional/blocked) wyłuskane z tamtych planów i
rekomenduje, co faktycznie warto robić dalej — z oceną, czy są jeszcze potrzebne,
czy istnieje lepsze rozwiązanie na dziś.

## 2. Weryfikacja: co zostało faktycznie wdrożone

| Plan (archiwum)                      | Status w kodzie (potwierdzony grepem/commitem)            |
| ------------------------------------ | --------------------------------------------------------- |
| 2026-08-06-retencja-modeli-ml        | WDROŻONE                                                  |
| 2026-08-06-spojny-pasek-gorny        | Kroki A–D wdrożone; E/F nie (patrz niżej)                 |
| 2026-08-07-naprawy-ai-ml-dashboard   | WDROŻONE (commit b84b240, testy 1481/1481)                |
| 2026-08-07-pierwszy-model-ai-ml      | Faza A wdrożona, Faza B przetestowana; operacyjnie w toku |
| 2026-08-08-usprawnienia-modulu-excel | WDROŻONE (commity 9c44d07/e1eb742)                        |
| 2026-08-08-zlecenia-wirtualizacja    | Fazy 0–6 wdrożone; 7 zablokowana, 8 opcjonalna            |
| 2026-08-09-spojny-styl-index         | WDROŻONE (commit 8de47f8)                                 |

## 3. Pozostałe otwarte pozycje — ocena aktualności

| #   | Pozycja                                                                                                                                     | Źródło (plan)          | Stan                                       | Ocena dziś                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Krok E** — klasa `.ai-status-badge` w `spa.css` (przeniesienie inline style z `app.html`), usunięcie martwych `.ai-status-online/offline` | pasek-gorny E          | Opcjonalny, tani (~20 linii)               | **Niskiej wartości** — martwe klasy `.ai-status-online/offline` już usunięte (grep = 0); inline style działa i nie migocze (krok B wdrożony). Przeniesienie do klasy = czystość CSS, zero funkcji.       |
| 2   | **Krok F** — konsolidacja `header-right` do `public/js/shared/headerUser.js`                                                                | pasek-gorny F          | Świadomie poza zakresem (osobna iteracja)  | **Jedyna pozycja z realną wartością refaktoru**: header-right zduplikowany w 4–6 plikach (`app.html`, `kartoteka.html`, `partials/header.html`, `partials/rury/header.html` + warianty studni). SRP/DRY. |
| 3   | **P3** — klasy `nav-accent-builder/offer/pricelist` bez definicji w CSS                                                                     | pasek-gorny P3         | Drobna kosmetyka                           | **Martwe atrybuty** — klasy niezdefiniowane nigdzie; usunąć albo zdefiniować akcent. Niska wartość, ale zero ryzyka.                                                                                     |
| 4   | **Faza 7** — duplikaty PZ w zleceniach                                                                                                      | zlecenia-wirtualizacja | ZABLOKOWANA (brak reguły biznesowej)       | **Nie robić** — semantyka „duplikatu PZ" wymaga decyzji użytkownika. Zostaje w archiwum jako przypis.                                                                                                    |
| 5   | **Faza 8** — grid-swap (pełna wirtualizacja renderera)                                                                                      | zlecenia-wirtualizacja | OPCJONALNA (tylko na żądanie pixel-parity) | **Nie robić** — `MAX_LOADED` + kontener scrolla już rozwiązują jank; utrzymywanie 2 rendererów to anty-wzorzec.                                                                                          |

## 4. Rekomendacja

**TERAZ — jedyna pozycja z realną wartością**: Krok F (`headerUser.js`) — konsolidacja
header-right. Uzasadnienie:

- Ten sam blok HTML (username, rola, wyloguj, wersja, badge AI) istnieje w 4+ plikach
  z drobnymi różnicami → każda zmiana badge/UI wymaga edycji wielu miejsc.
- Jest to czysty refaktor (SRP/DRY) bez zmiany funkcji — niskie ryzyko.
- Po wdrożeniu automatycznie znika pozycja P3 (klasa `nav-accent-*` ustalana w jednym
  miejscu).

**POMIJAĆ**: pozycje 1 (krok E — kosmetyka bez zysku), 4 (faza 7 — zablokowana), 5 (faza 8 — anty-wzorzec).

**Opcjonalnie dołączyć do F**: pozycja 3 (P3) — usunięcie martwych klas `nav-accent-*`.

> Uwaga: plan nie zakłada zmian w `?v=` (cache-bust przez release) ani w logice
> funkcjonalnej modułów.

## 5. Zakres zmian — krok implementacyjny

### Krok F — `public/js/shared/headerUser.js`

- **Cel**: jeden moduł inicjalizujący `header-right` (username, badge roli, przycisk wyloguj, wersja, badge AI) przez atrybut `data-header-user`.
- **Pliki źródłowe do podpięcia**: `public/app.html`, `public/kartoteka.html`, `public/partials/header.html`, `public/partials/rury/header.html` (+ warianty studni).
- **Zakres**: wydzielić istniejącą logikę (np. z `dashboard.js`/`app.js` — sprawdzić faktyczne init username/role/logout) do jednego modułu; `window.headerUser.init(container)`.
- **Priorytet**: średni (czystość kodu, nie funkcja). **Ryzyko**: niskie — regresja = brak username/badgu w którymś headerze, łatwe do wychwycenia wizualnie.
- **Weryfikacja**: `node -c` nowego modułu; `npm run lint:frontend`; `npm run format`; ręcznie — wszystkie 4+ wejściówki pokazują username/rolę/wyloguj/badge AI; SPA sanity (Studnie/Rury/Kartoteka).

### Krok P3 — usunięcie martwych `nav-accent-*` (dołączyć do F)

- **Plik**: `public/js/spa/router.js:117` + `public/partials/rury/header.html:50,58,66`.
- **Zmiana**: usunąć przypisanie klasy `nav-accent-${s.id}` (niezdefiniowanej w CSS) albo zdefiniować 3 reguły akcentu. Rekomendacja: usunąć — brak efektu wizualnego.
- **Priorytet**: niski. **Ryzyko**: zerowe.

## 6. Strategia testów

- `node -c public/js/shared/headerUser.js`
- `npm run lint:frontend`, `npm run format`, `npm run typecheck:frontend`
- `npm run test:quick` (sanity)
- Ręcznie: logowanie, wszystkie moduły (Studnie/Rury/Kartoteka/Zlecenia) — header-right kompletny i spójny.

## 7. Kryteria sukcesu

- [ ] `headerUser.js` istnieje i jest podpięty we wszystkich wejściówkach (grep `data-header-user` ≥ 4).
- [ ] Usunięta duplikacja inline init username/role/logout z `app.html`/`dashboard.js`/`kartoteka.html`.
- [ ] Martwe `nav-accent-*` usunięte (grep = 0).
- [ ] Brak regresji wizualnej header-right (username, badge roli, wyloguj, badge AI, wersja).
- [ ] `npm run validate` zielone; `npm run format` wykonany.
