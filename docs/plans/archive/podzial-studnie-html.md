# Plan podziału `studnie.html` (5350 linii)

## Cel architektoniczny

Podział ma poprawić czytelność i możliwość utrzymania kodu. Nie zmieniamy logiki biznesowej, identyfikatorów (`id`), klas CSS, nazw funkcji ani kolejności inicjalizacji JavaScript. Po refaktoryzacji aplikacja ma działać identycznie jak przed zmianami.

---

## Stan obecny

| Sekcja                                 | Linie     |    Linii | Opis                                                      |
| -------------------------------------- | --------- | -------: | --------------------------------------------------------- |
| HEAD + HEADER + NAV                    | 1–150     |      150 | `<head>`, meta, CSS, header, nawigacja, otwarcie `<main>` |
| **section-builder**                    | 151–4096  | **3946** | Główny kreator                                            |
| ├ Diagram + centrum + wizard indicator | 151–340   |      190 | Panel lewy (SVG), kolumna środkowa, wskaźnik kroków       |
| ├ wizard-step-1 (Dane klienta)         | 341–643   |      303 | Formularz klienta i oferty                                |
| ├ wizard-step-2 (Parametry)            | 644–1698  |     1055 | Parametry studni (konstrukcja, powłoka, osprzęt, klasy)   |
| ├ wizard-step-3 (Kalkulator)           | 1699–2519 |      821 | Konfigurator oferty (DN, kręgi, przejścia, tabele)        |
| ├ wizard-step-4 (Karta budowy)         | 2522–3621 |     1100 | Formularz karty budowy                                    |
| └ Panel boczny (wells-sidebar)         | 3622–4090 |      469 | Lista studni, zakładki, rabaty                            |
| **section-offer**                      | 4097–4386 |  **290** | Widok oferty                                              |
| **section-pricelist**                  | 4387–5207 |  **821** | Widok cennika                                             |
| Script tags                            | 5208–5348 |      141 | Toast + ~130 zewnętrznych skryptów                        |
| `</body></html>`                       | 5349–5350 |        2 | Zamknięcie                                                |

---

## Zasady dla partiali

- partial nie zawiera `<html>`, `<head>` ani `<body>`
- partial zawiera wyłącznie fragment HTML
- każdy partial ma jednego głównego wrappera
- nie zmieniać `id`
- nie zmieniać nazw klas
- nie zmieniać atrybutów `data-*`
- nie zmieniać `onclick`

---

## Zasada zero zmian funkcjonalnych

Podział HTML nie może zmieniać:

- kolejności wykonywania JS
- inicjalizacji
- eventów
- działania CSS
- działania modali
- działania drag&drop
- działania wizarda

---

## Struktura docelowa

```
public/
    studnie.html                     (~ 400 linii) — szkielet aplikacji
    partials/
        header.html                  (~ 150 linii) — HEAD + HEADER + NAV
        wizard/
            step1-client.html        (~ 303 linii) — dane klienta i oferty
            step2-parameters.html    (~ 1055 linii) — parametry studni
            step3-offer.html         (~ 821 linii) — konfigurator oferty
            sidebar.html             (~ 469 linii) — panel boczny (lista studni, rabaty)
            step4-build-card.html    (~ 1100 linii) — karta budowy
        offer/
            offer.html               (~ 290 linii) — widok oferty
        pricelist/
            pricelist.html           (~ 821 linii) — widok cennika
```

### `studnie.html` (~400 linii)

Pozostaje jako plik składający całość:

- `<head>` — meta, tytuł, podstawowe SEO
- `<header>` — logo, nawigacja modułów (Pulpit, Studnie, Rury, Kartoteka)
- `<main>` — kontenery sekcji (section-builder, section-offer, section-pricelist)
- Importy CSS (6 arkuszy)
- Importy JS (~130 skryptów)
- `<div id="toast-container">`

Automatyczne ładowanie partiali przez JS:

```html
<!-- HEADER załadowany z partials/header.html -->
<header id="app-header"></header>

<!-- SEKCJE załadowane z partials/ -->
<div class="section active" id="section-builder">
    <div class="well-app-layout">
        <div id="diagram-panel"></div>
        <div id="center-column"></div>
        <div id="wizard-container"></div>
    </div>
    <div id="wells-sidebar-container"></div>
</div>
<div class="section" id="section-offer" data-partial="partials/offer/offer.html"></div>
<div class="section" id="section-pricelist" data-partial="partials/pricelist/pricelist.html"></div>
```

### Template Loader

Odpowiedzialność:

- ładowanie partiali z katalogu `partials/`
- cache (wykorzystać istniejący mechanizm w `getTemplate()`)
- obsługa błędów (jeśli partial nie istnieje, log + fallback)
- ponowne renderowanie ikon Lucide po każdym załadowaniu (`lucide.createIcons()`)
- zwracanie `Promise<string>`

Wykorzystać istniejącą funkcję `getTemplate(path)` z `public/js/studnie/printManager.js`:

```js
async function loadPartials() {
    const partials = [
        { id: 'app-header', path: 'partials/header.html' },
        { id: 'wizard-step-1', path: 'partials/wizard/step1-client.html' },
        { id: 'wizard-step-2', path: 'partials/wizard/step2-parameters.html' },
        { id: 'wizard-step-3', path: 'partials/wizard/step3-offer.html' },
        { id: 'wizard-step-4', path: 'partials/wizard/step4-build-card.html' },
        { id: 'wells-sidebar', path: 'partials/wizard/sidebar.html' },
        { id: 'section-offer', path: 'partials/offer/offer.html' },
        { id: 'section-pricelist', path: 'partials/pricelist/pricelist.html' }
    ];

    for (const { id, path } of partials) {
        const el = document.getElementById(id);
        if (el) {
            try {
                el.innerHTML = await getTemplate(path);
            } catch (e) {
                console.error(`Failed to load partial: ${path}`, e);
            }
        }
    }

    lucide.createIcons();
}
```

---

## Opis partiali

### `partials/header.html` (~150 linii)

Przeniesione z `studnie.html` linie 1–150: logo, nawigacja modułów (Pulpit, Studnie, Rury, Kartoteka), przycisk wylogowania.

**Uwaga:** `<!doctype>`, `<html>`, `<head>` i otwarcie `<body>` pozostają w `studnie.html`, nie w partialu.

**Zależności:** brak (czysty HTML + ikony Lucide).

---

### `partials/wizard/step1-client.html` (~303 linie)

Przeniesione z `studnie.html` linie 341–643:

- Formularz danych klienta (nr klienta, firma, NIP, adres)
- Formularz oferty (nr oferty, data, km, stawka, uwagi)
- Przyciski nawigacji (Dalej →)
- `id="wizard-step-1"`

**Zależności:** `window.offerData`, `window.clientManager`, `window.loadClientsDb`, `window.saveClientDb`.

---

### `partials/wizard/step2-parameters.html` (~1055 linii)

Przeniesione z `studnie.html` linie 644–1698:

- Kolumna 1: Konstrukcja — klasy ekspozycji XA0-XA3, XF1-XF4, agresja mrozowa, siarczanowa, scieralna, WL4
- Kolumna 2: Powłoka i kineta — malowanie, rodzaj kinety, uszczelki, właz
- Kolumna 3: Osprzęt — stopnie, poręcze, komplety, PSIA BUDA
- Klasy nośności (płyta, nadbudowa, kineta)
- `id="wizard-step-2"`

**Uwaga:** Największy partial (~1055 linii), ale stanowi spójną całość — wszystkie parametry studni. Nie dzielić go dalej.

**Zależności:** `validateWizardStep2()`, `updateParamInput()`, `wizardNext()`, `wizardPrev()`, `window.currentWell`, `window.offerData`, `window.selectedWell`.

---

### `partials/wizard/step3-offer.html` (~821 linii)

Przeniesione z `studnie.html` linie 1699–2519:

- Pasek podsumowania (summary bar)
- Obszar konfiguracji (centrum)
- Toolbar DN + rzędne + wysokość
- Parametry per-well (dziedziczone z kroku 2)
- Zakładki: zawartość betonowa, przejścia
- `id="wizard-step-3"`

**Zależności:** `window.wells`, `window.currentWellIndex`, `window.studnieProducts`, `renderWellDiagram()`, `renderOfferTable()`, `runJsAutoSelection()`, `calculateWellErrors()`.

---

### `partials/wizard/sidebar.html` (~469 linii)

Przeniesione z `studnie.html` linie 3622–4090:

- Lista studni z wyszukiwarką
- Przyciski: zapisz ofertę, zamówienie, zlecenia
- Zakładki: lista | rabaty
- `class="wells-sidebar"`

**Zależności:** `window.wells`, `window.currentWellIndex`, `switchSidebarTab()`, `window.saveOfferStudnie()`, `window.createOrderFromOffer()`.

---

### `partials/wizard/step4-build-card.html` (~1100 linii)

Przeniesione z `studnie.html` linie 2522–3621:

- Kopiowanie karty z istniejącego zamówienia
- Emaile (faktura, e-faktura)
- Adres i płatności
- Ubezpieczenie
- Osoba do kontaktu
- Transport
- `id="wizard-step-4"`

**Zależności:** `collectKartaBudowyDataStep4()`, `initKartaBudowyStep4()`, `_resetKartaBudowyForm()`, `_calcTransportCosts()`, `getKartaBudowyCopyOrders()`.

---

### `partials/offer/offer.html` (~290 linii)

Przeniesione z `studnie.html` linie 4097–4386:

- Baner kontekstu oferty/zamówienia
- Podsumowanie klienta i oferty
- Tabela oferty (`id="offer-items-body"`)
- Przyciski akcji (PDF, Word, XLSX, druk, rabaty)

**Zależności:** `renderOfferSummary()`, `window.currentOffer`, `printOfferStudnie()`, `exportStudnieOrderAsOffer_action()`, `showItemDiscountModal()`.

---

### `partials/pricelist/pricelist.html` (~821 linii)

Przeniesione z `studnie.html` linie 4387–5207:

- Pasek narzędzi (wyszukiwarka, przyciski Dodaj/Zapisz/Eksport/Import)
- Tabela cennika
- Filtry kategorii
- Formularze edycji produktów

**Zależności:** `showAddStudnieProductModal()`, `saveStudniePriceList()`, `exportStudnieToExcel()`, `importStudnieFromExcel()`, `filterPriceList()`.

---

## Co zostawić razem (nie dzielić)

- **step2-parameters.html** (~1055 linii) — wszystkie parametry studni to spójna całość
- **step4-build-card.html** (~1100 linii) — karta budowy jako jeden krok kreatora
- **Diagram SVG** — jest już generowany przez JS (`wellDiagram.js`), nie HTML
- **Modale** — większość modali jest generowana dynamicznie przez JS (`popups*.js`)

---

## Kolejność wdrożenia

| Krok      | Co zrobić                                                               | Ryzyko      | Czas       |
| --------- | ----------------------------------------------------------------------- | ----------- | ---------- |
| 1         | Wydzielić `partials/offer/offer.html` (~290 linii, najmniej zależności) | Niskie      | ~1h        |
| 2         | Wydzielić `partials/pricelist/pricelist.html` (~821 linii)              | Niskie      | ~2h        |
| 3         | Wydzielić `partials/wizard/step1-client.html` (~303 linie)              | Niskie      | ~1h        |
| 4         | Wydzielić `partials/wizard/step3-offer.html` (~821 linii)               | Średnie     | ~2h        |
| 5         | Wydzielić `partials/wizard/step2-parameters.html` (~1055 linii)         | Średnie     | ~3h        |
| 6         | Wydzielić `partials/wizard/sidebar.html` (~469 linii)                   | Średnie     | ~1.5h      |
| 7         | Wydzielić `partials/wizard/step4-build-card.html` (~1100 linii)         | Wysokie     | ~3h        |
| 8         | Oczyścić `studnie.html` do ~400 linii, dodać loader partiali            | Średnie     | ~2h        |
| **Razem** |                                                                         | **Średnie** | **~2 dni** |

Uzasadnienie kolejności: partiale o najmniejszej liczbie zależności są robione najwcześniej. `step2` i `step4` mają najwięcej zależności — im później je ruszysz, tym lepiej.

---

## Procedura po każdym etapie

Po wydzieleniu każdego partiala:

```
□ aplikacja uruchamia się
□ brak błędów JS w konsoli
□ działa wizard (nawigacja między krokami)
□ działa zapis oferty
□ działa otwieranie istniejących ofert
□ działa cennik (filtrowanie, edycja, zapis)
□ działa SVG (renderowanie diagramu studni)
□ działa drag&drop elementów
□ działa druk (PDF, Word)
□ działa eksport (XLSX)
```

W razie problemów:

1. `git checkout -- public/studnie.html` — przywraca oryginał
2. Sprawdzić czy partial został poprawnie wycięty
3. Sprawdzić czy `id` i klasy w partialu są identyczne z oryginałem
4. Przejrzeć zależności JS dla danego partiala

---

## Rollback

Po każdym etapie:

1. `git add -A`
2. `git commit -m "refactor(studnie): wydzielono [nazwa partiala]"`
3. `git tag refactor/studnie/[nazwa-partiala]-done`
4. Uruchomić checklistę

W razie problemów w 5 sekund:

```bash
git checkout -- public/studnie.html
```

---

## Obsługa inline stylów

Docelowo style inline (obecnie ~3000+ linii w atrybutach `style=""`) należy przenieść do klas CSS w `studnie.css` lub nowych plikach CSS:

- `css/studnie/wizard.css` — style dla kreatora
- `css/studnie/offer.css` — style dla widoku oferty
- `css/studnie/pricelist.css` — style dla cennika

To można robić równolegle z podziałem HTML, ale jest to zadanie niezależne i może być wykonane później.

---

## Obsługa onclick

129 atrybutów `onclick` w HTML docelowo zastąpić przez `addEventListener` w JS. To jednak wymaga refaktoryzacji JS i **nie jest częścią tego planu** — plan dotyczy wyłącznie podziału HTML.

---

## Ryzyka

- brak inicjalizacji Lucide po załadowaniu partiala (`lucide.createIcons()`)
- utrata eventów inline — nie ruszamy `onclick`, ale trzeba zweryfikować czy działają po przeniesieniu HTML
- zmiana kolejności ładowania skryptów — JS nie może odpalić się przed załadowaniem partiala
- brak elementów DOM podczas startu JS — JS uruchamiany po `DOMContentLoaded` musi poczekać na partiale
- podwójne renderowanie — jeśli `getTemplate()` i `lucide.createIcons()` zostaną wywołane wielokrotnie
- race condition podczas ładowania wielu partiali naraz — użyć `Promise.all()` lub sekwencyjnie

---

## Poza zakresem (czego NIE robić)

| Czynność                                   | Status        |
| ------------------------------------------ | ------------- |
| ❌ refaktoryzacja JS                       | Poza zakresem |
| ❌ zamiana `onclick` na `addEventListener` | Poza zakresem |
| ❌ usuwanie inline CSS (`style=""`)        | Poza zakresem |
| ❌ zmiana nazw klas CSS                    | Poza zakresem |
| ❌ zmiana `id` elementów                   | Poza zakresem |
| ❌ zmiana arkuszy CSS                      | Poza zakresem |
| ❌ zmiana logiki wizarda                   | Poza zakresem |
| ❌ zmiana renderowania SVG                 | Poza zakresem |
| ❌ zmiana kolejności skryptów              | Poza zakresem |
| ❌ dodawanie/usuwanie zależności npm       | Poza zakresem |

---

## Kryteria zakończenia

Refaktoryzacja zakończona gdy:

- ✓ `studnie.html` ma około 300–500 linii
- ✓ wszystkie widoki działają (builder, oferta, cennik)
- ✓ brak błędów JS w konsoli
- ✓ wszystkie partiale ładują się poprawnie
- ✓ brak zmian funkcjonalnych
- ✓ wszystkie testy z checklisty zakończone sukcesem
