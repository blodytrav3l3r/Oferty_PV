# Plan: Dostosowanie kodu do wytycznych UI/UX (SSoT)

> Data: 2026-08-21 · Wersja docelowa: bez zmian wersji (refaktory, nie release) · Baza: `main`
>
> Wytyczne źródłowe: `docs/UI_GUIDELINES.md` (SSoT, podpięte do `AGENTS.md`).

## 1. Cel

Zamknąć największe rozjazdy projektu względem `docs/UI_GUIDELINES.md`:

1. **Modale/popupy budowane inline w JS** → wzorzec `modalCore.js` (`showModal`/`closeModal`).
2. **Inline `style=` / `style.cssText`** → klasy istniejące lub nowe modyfikatory.
3. **Duplikacja klas wspólnych** w CSS modułowych → modyfikatory `--<moduł>`.
4. Luki `escapeHtml` i `aria-label` — audyt + domknięcie.

Priorytet: największy zysk punktowy za najmniejsze ryzyko. Każda faza = **osobny commit**
(izolowany rollback), pełna weryfikacja przed commitem.

## 2. Stan wyjściowy (audyt z 2026-08-21)

| Obszar          | Pomiar                                                                                | Ocena |
| --------------- | ------------------------------------------------------------------------------------- | ----- |
| Tokeny kolorów  | 14 plików CSS; hex tylko w `style.base.css` `:root`; 0 hex w modułach                 | 10/10 |
| Z-index         | JS: 0 twardych `z-index:N`; wszystkie przez `LAYERS.*`/`LAYERS_EXCEL.*`               | 10/10 |
| Ikony           | 511 × `data-lucide`, 122 × `createIcons`; emoji-ikony nieobecne                       | 8/10  |
| Modale          | `modalCore.js` używany w 6 miejscach; **3 modale inline w `wellTransitionsPopup.js`** | 3/10  |
| Inline style    | ~370 atrybutów `style=` w `public/partials/**`                                        | 3/10  |
| Duplikacja klas | `.form-input` scoped w 3 modułach, `.search-box` w 3 plikach (szczegóły §6)           | 5/10  |
| XSS             | `clientManager.js` escapuje (`escapeHtml` + `textContent`); potwierdzić resztę        | 7/10  |
| A11y            | `prefers-reduced-motion` w 5 plikach; `aria-label` na ikonach nierównomiernie         | 6/10  |

**Ważne ustalenia z audytu (korygują wcześniejsze szacunki):**

- `clientManager.js:116` **już używa** `showModal({...})` — mechanizm modala zgodny; do poprawy
  zostają **inline style wewnątrz** HTML modala (linie 119–134).
- `.form-input`/`.search-box` w modułach to **selektory scoped** (`.zlecenia-virtual-toolbar
.form-input` itd.), NIE gołe nadpisania — ryzyko fiksacji wizualnej przy unifikacji jest niskie.
- `.modal-panel-xl` (używany w `wellTransitionsPopup.js:258,338`) **nie istnieje w CSS** —
  modale przejść są w 100% inline-styled; migracja na `.modal` daje im styl za darmo.
- `modalCore.js` jest ES module, ładowany w `studnie.html:275` jako `type="module"`, i
  wystawia mostek `window.showModal`/`window.closeModal` (linie 125–128). Pliki legacy
  (plain script) wołają przez mostek — działa, bo wywołania są w runtime (klik), nie w load.
- `FLOW_TYPES = Object.freeze({ WYLOT:'wylot', WLOT:'wlot', DOLOT:'dolot' })`
  (`public/js/shared/constants.js:5`) — wartości **małymi literami**.

## 3. Zasady wykonania (obowiązują w każdej fazie)

- Commit przez `node scripts/commit.mjs "refactor(ui): ..."` (scope `ui` z dozwolonej listy).
- Przed każdym commitem: `npm run version:check`, `npm run validate` (typecheck backend+frontend,
  lint backend+frontend), `npm run format`.
- Po każdej edycji `public/js/*.js`: `node -c <plik>` (składnia).
- Frontend `public/js/` NIE jest typowany przez tsc — sprawdzany `typecheck:frontend` + `lint:frontend`.
- **Nie zmieniać** `modalCore.js`, `style.base.css`, `style.responsive.css` (współdzielone) —
  wyłącznie **dodatkowe** CSS w plikach modułowych i zmiany w plikach fazy.
- Żadnych nowych warstw z-index, żadnych gołych hexów, żadnych emoji-ikon, żadnych placeholderów.
- Każda faza kończy się pozytywnym przebiegiem testów fazy + checklistą ręczną §4.8.

---

## 4. Faza 1 — migracja 3 modalów przejść na `modalCore.js` (priorytet najwyższy)

Plik: `public/js/studnie/wellTransitionsPopup.js`.

Cel: zamienić ręczne `document.createElement` + `position:fixed` + `data-action="wtCloseModal"`
na `window.showModal({...})` (przez mostek z modalCore). Zysk: focus trap, Escape, click-outside,
ARIA, spójny wygląd — bez własnej logiki.

### 4.1 API docelowe `showModal` (do wykorzystania)

```js
window.showModal({
    id: 'flow-type-modal',
    titleId: 'flow-type-title',
    html: '<div class="modal modal--prz-flow">…</div>'
});
```

- Nadpisuje istniejący overlay o tym samym `id` (linia 80–81 modalCore) → brak duplikatów.
- Zamyka: Escape, klik w tło (gdy `e.target === overlay`), `closeModal(id)`.
- Fokus: pułapka Tab/Shift+Tab, pierwszy `<button>` dostaje fokus po 50 ms.

### 4.2 Nowe CSS (wyłącznie w `public/css/studnie/modal.css`)

Modyfikatory klasy bazowej `.modal` (zgodnie z wytyczną „warianty przez `--<moduł>`”):

```css
/* modale przejść (wellTransitionsPopup.js) — warianty .modal */
.modal--prz {
    width: min(760px, 94vw);
    max-height: min(85vh, 720px);
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
    gap: 0.8rem;
}
.modal--prz-flow {
    width: min(340px, 92vw);
    text-align: center;
}

/* siatka typów / średnic */
.prz-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, 192px);
    justify-content: center;
    gap: 11px;
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    padding: 0.2rem;
}
.prz-grid-btn {
    width: 192px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.2rem 0.6rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: var(--fs-lg);
    font-weight: var(--fw-bold);
    text-align: center;
    transition: all 0.15s;
    background: rgba(var(--white-rgb), 0.05);
    border: 1px solid rgba(var(--white-rgb), 0.1);
}
.prz-grid-btn:hover {
    background: rgba(var(--accent-rgb), 0.15);
    border-color: rgba(var(--accent-rgb), 0.3);
}
.prz-grid-btn--active {
    background: rgba(var(--accent-rgb), 0.2);
    border-color: rgba(var(--accent-rgb), 0.5);
    color: var(--accent-hover, var(--accent));
}
.prz-grid-btn--active:hover {
    background: rgba(var(--accent-rgb), 0.2);
    border-color: rgba(var(--accent-rgb), 0.5);
}

/* przyciski WLOT/WYLOT */
.prz-flow-btn {
    flex: 1;
    padding: 1.2rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-weight: var(--fw-extrabold);
    font-size: var(--fs-3xl);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    transition: all 0.2s;
}
.prz-flow-btn--wlot {
    background: rgba(var(--blue-rgb), 0.2);
    color: var(--blue-hover);
    border: 2px solid rgba(var(--blue-rgb), 0.8);
}
.prz-flow-btn--wlot:hover {
    background: rgba(var(--blue-rgb), 0.5);
}
.prz-flow-btn--wylot {
    background: rgba(var(--danger-rgb), 0.2);
    color: var(--danger-hover);
    border: 2px solid rgba(var(--danger-rgb), 0.8);
}
.prz-flow-btn--wylot:hover {
    background: rgba(var(--danger-rgb), 0.5);
}
```

> Uwaga: `rgba(var(--white-rgb), …)`/`rgba(var(--blue-rgb), …)` — te zmienne **istnieją**
> w `:root` (`style.base.css`); przed commitem potwierdzić grepem `--blue-rgb`, `--danger-rgb`,
> `--white-rgb`, `--accent-rgb`, `--blue-hover`, `--danger-hover`. Jeżeli któregoś brak —
> użyć ekwiwalentu istniejącego (np. `--accent-rgb`), nie dodawać nowego tokenu.

### 4.3 `openFlowTypePopup` — postać docelowa

Usuń blok `document.createElement` + overlay (linie 182–203) i sekcję `showModal(id, display)`
(205–209). Zastąp:

```js
window.openFlowTypePopup = function (index) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;

    showModal({
        id: 'flow-type-modal',
        titleId: 'flow-type-title',
        html: `
        <div class="modal modal--prz-flow">
            <h3 class="mb-1-white-3xl" id="flow-type-title">Wybierz typ przepływu</h3>
            <div style="display:flex; gap:1rem; justify-content:center;">
                <button id="flow-wlot-btn" class="prz-flow-btn prz-flow-btn--wlot"
                    data-action="wtSetFlow" data-index="${index}" data-flow="wlot">
                    <span class="fs-8xl"><i data-lucide="download"></i></span>WLOT
                </button>
                <button id="flow-wylot-btn" class="prz-flow-btn prz-flow-btn--wylot"
                    data-action="wtSetFlow" data-index="${index}" data-flow="wylot">
                    <span class="fs-8xl"><i data-lucide="upload"></i></span>WYLOT
                </button>
            </div>
            <button class="mt-15-p5" onclick="closeModal()">Anuluj</button>
        </div>`
    });
};
```

> Uwaga: `data-flow="wlot"/"wylot"` — wartości z `FLOW_TYPES` (małe litery), nie etykiety.

### 4.4 Nowa funkcja potwierdzająca wybór przepływu

```js
window.confirmPrzejscieFlow = function (index, flow) {
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;
    if (flow !== FLOW_TYPES.WLOT && flow !== FLOW_TYPES.WYLOT) return;
    well.przejscia[index].flowType = flow;
    well.przejscia[index].flowTypeManual = true;
    closeModal();
    renderWellPrzejscia();
    window.refreshZleceniaModalIfActive();
};
```

(Usuń stare `onclick` na `flow-wlot-btn`/`flow-wylot-btn` z linii 211–225.)

### 4.5 `openChangePrzejscieTypePopup` — postać docelowa

Usuń `let modal = …` (249–254) oraz opakowanie `position:fixed` (257–278). Zastąp
`modal.innerHTML = …` na `showModal`:

```js
showModal({
    id: 'change-prz-type-modal',
    titleId: 'change-prz-type-title',
    html: `
    <div class="modal modal--prz">
        <h3 class="mb-1-white-3xl" id="change-prz-type-title">Zmień rodzaj przejścia</h3>
        <div class="prz-grid">
            ${allTypes
                .map((t) => {
                    const isActive = t === currProduct.category;
                    return `<button data-action="confirmChangePrzejscieType" data-index="${index}" data-t="${escapeJsStr(t)}"
                         class="prz-grid-btn ${isActive ? 'prz-grid-btn--active' : ''}">
                         ${escapeHtml(t)}
                    </button>`;
                })
                .join('')}
        </div>
        <button class="mt-15-p5" onclick="closeModal()">Anuluj</button>
    </div>`
});
```

Usuń końcowe `if (modal) modal.style.display = 'flex';` (linia 280).

### 4.6 `openChangePrzejscieDnPopup` — postać docelowa

Analogicznie do 4.5 (linie 329–362). Usuń `let modal`/`modal.innerHTML`/`style.display`.
Zastąp `showModal({ id:'change-prz-dn-modal', titleId:'change-prz-dn-title', html: … })`.
Przycisk kafelka: `class="prz-grid-btn ${isActive ? 'prz-grid-btn--active' : ''}"`,
`data-action="confirmChangePrzejscieDn" data-index data-id="${escapeJsStr(p.id)}"`,
treść `escapeHtml(dnLabel)`. Usuń wszystkie `onmouseenter/onmouseleave` (przechodzą do CSS hover).

### 4.7 Delegacja `data-action` (linie 132–160)

- Usuń gałęzie `wtStopPropagation` (145–146) i `wtCloseModal` (147–148) — niepotrzebne
  (modalCore sam obsługuje click-outside; tło zamyka tylko gdy `e.target === overlay`).
- Dodaj gałąź:
    ```js
    } else if (action === 'wtSetFlow') {
        window.confirmPrzejscieFlow(parseInt(index, 10), el.getAttribute('data-flow'));
    }
    ```
- Gałęzie `confirmChangePrzejscieType`/`confirmChangePrzejscieDn` zostają bez zmian.

### 4.8 `confirmChangePrzejscieType` / `confirmChangePrzejscieDn`

Zamień zamykanie przez `getElementById(...).style.display = 'none'` na `closeModal();`
(linie 300–301 oraz 378–379). Logika mutacji `well` i czyszczenie `frozen*` — **bez zmian**.

### 4.9 Testy — nowy plik `tests/studnie/transitionsModals.test.ts`

Wzorzec harnessu: `tests/studnie/excelWellLock.test.ts` (vm, bez jsdom — jsdom NIE jest
zależnością projektu). Stub `document` rozszerzony o metody używane przez
`wellTransitionsPopup.js` (tylko call-time; plik nie wykonuje DOM w load):

```ts
// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const read = (f) => fs.readFileSync(path.join(__dirname, '../../public/js/studnie/' + f), 'utf8');

function runContext() {
    const well = {
        dn: '600',
        przejscia: [
            {
                productId: 'przejscie-160-0.5',
                rzednaWlaczenia: 1.2,
                flowType: 'wlot',
                flowTypeManual: false
            }
        ],
        config: []
    };
    const showModalCalls = [];
    let closeCalls = 0;
    const renderWellPrzejscia = jest.fn();
    const refreshZleceniaModalIfActive = jest.fn();
    const showToast = jest.fn();
    const docStub = {
        getElementById: () => null,
        createElement: () => ({
            style: {},
            setAttribute() {},
            appendChild() {},
            addEventListener() {},
            remove() {},
            innerHTML: ''
        }),
        body: { appendChild: () => {} },
        addEventListener: () => {},
        querySelector: () => null,
        querySelectorAll: () => []
    };
    const studnieProducts = [
        {
            id: 'przejscie-160-0.5',
            name: 'Przejście 160',
            componentType: 'przejscie',
            dn: 160,
            height: 0,
            active: 1,
            category: 'Przejścia 160'
        },
        {
            id: 'przejscie-200-0.5',
            name: 'Przejście 200',
            componentType: 'przejscie',
            dn: 200,
            height: 0,
            active: 1,
            category: 'Przejścia 200'
        },
        {
            id: 'przejscie-250-0.5',
            name: 'Przejście 250',
            componentType: 'przejscie',
            dn: 250,
            height: 0,
            active: 1,
            category: 'Przejścia 200'
        }
    ];
    const context = {
        window: {},
        document: docStub,
        studnieProducts,
        getCurrentWell: () => well,
        isOfferLocked: () => false,
        isWellLocked: () => false,
        OFFER_LOCKED_MSG: 'x',
        WELL_LOCKED_MSG: 'y',
        showToast,
        renderWellPrzejscia,
        refreshZleceniaModalIfActive,
        closeModal: () => {
            closeCalls++;
        },
        showModal: (opts) => {
            showModalCalls.push(opts);
            return { id: opts.id };
        },
        FLOW_TYPES: { WLOT: 'wlot', WYLOT: 'wylot', DOLOT: 'dolot' },
        escapeHtml: (s) =>
            String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        escapeHtmlAttr: (s) =>
            String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
        escapeJsStr: (s) =>
            String(s)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;'),
        LAYERS: { GENERIC_MODAL_BACKDROP: 2000, EXCEL_POPUP_BACKDROP: 2000 },
        autoSelectComponents: () => {}
    };
    vm.createContext(context);
    vm.runInContext(read('wellTransitionsPopup.js'), context);
    return {
        context,
        well,
        showModalCalls,
        closeCalls: () => closeCalls,
        renderWellPrzejscia,
        refreshZleceniaModalIfActive,
        showToast
    };
}
```

Przypadki (minimalny zestaw, każdy chroni przed regresją migracji):

1. `openFlowTypePopup(0)` → `showModalCalls` ma 1 wpis o `id === 'flow-type-modal'`;
   `html` zawiera `WLOT`, `WYLOT`, `data-lucide="download"`, `data-lucide="upload"`,
   `class="modal modal--prz-flow"`, **nie zawiera** `position:fixed` ani `data-action="wtCloseModal"`.
2. Blokady: `isOfferLocked: () => true` → `showToast` wywołany, `showModalCalls` puste.
3. `confirmPrzejscieFlow(0, 'wlot')` → `well.przejscia[0].flowType === 'wlot'`,
   `flowTypeManual === true`, `renderWellPrzejscia` + `refreshZleceniaModalIfActive` wywołane,
   `closeCalls() >= 1`. (Wariant `'wylot'` analogicznie.)
4. `openChangePrzejscieTypePopup(0)` → `showModalCalls[0].id === 'change-prz-type-modal'`;
   `html` zawiera nazwy kategorii (`Przejścia 160`, `Przejścia 200`), aktywna kategoria ma klasę
   `prz-grid-btn--active`, a XSS-owa kategoria (np. `A<b>`) jest escapowana (`&lt;b&gt;`).
5. `confirmChangePrzejscieType(0, 'Przejścia 200')` → `well.przejscia[0].productId === 'przejscie-200-0.5'`
   (pierwszy produkt kategorii posortowany po `dn`), pola `frozen*` usunięte, `closeModal` wywołane.
6. `openChangePrzejscieDnPopup(0)` → `html` zawiera `DN 160`, `DN 200`, `DN 250`;
   `confirmChangePrzejscieDn(0, 'przejscie-250-0.5')` ustawia `productId`, czyści `frozen*`, zamyka modal.

Uruchomienie: `npx jest tests/studnie/transitionsModals.test.ts`.

### 4.10 Checklista ręczna (regresja wizualna)

W przeglądarce (`npm run dev` → studnie → dodaj przejście):

- [ ] Klik w pole typu przejścia → modal WLOT/WYLOT z ciemnym tłem i animacją fadeIn.
- [ ] WLOT ustawia przepływ, modal zamyka się, znacznik na przejściu aktualizuje się.
- [ ] Zmiana rodzaju przejścia → siatka typów; aktywny typ podświetlony; wybór zmienia produkt.
- [ ] Zmiana średnicy → siatka DN; wybór zmienia produkt i przelicza ofertę (`autoSelectComponents(true)`).
- [ ] `Escape` zamyka modal; klik w tło (poza panelem) zamyka; Tab cykluje wewnątrz (focus trap).
- [ ] Fokus ląduje na pierwszym przycisku modala po otwarciu.
- [ ] Brak scrolla strony głównej przy otwartym modalu (`overscroll-behavior: contain` z `.modal-overlay`).
- [ ] Zamknięta/zablokowana oferta → `showToast` blokady, modal się nie otwiera.

### 4.11 Ryzyka regresji (Faza 1)

| Ryzyko                                                                     | Mitigacja                                                                                                                                                                                                    |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Zmiana zachowania zamknięcia (dawniej `display:none` z pozostawieniem DOM) | `showModal` usuwa istniejący overlay o tym samym `id` (modalCore:80–81); żaden inny kod nie sięga po `getElementById('flow-type-modal'/'change-prz-*')` poza `wellTransitionsPopup.js` (potwierdzone grepem) |
| Fokus na pierwszym kafelku zamiast na „Anuluj"                             | Akceptowalne; pierwszy kafelek jest użytecznym miejscem startu; focus trap działa                                                                                                                            |
| `data-flow` wartości lowercase vs etykiety WLOT/WYLOT                      | `confirmPrzejscieFlow` waliduje przeciw `FLOW_TYPES`; test #3                                                                                                                                                |
| Z-index zmieniony (`.modal-overlay` → `--z-modal-top`)                     | Modal przejść nie koliduje z żadnym sąsiednim overlayem (mapowanie weryfikowane w §4.10)                                                                                                                     |
| Zmiana wyglądu panelu (`.modal` zamiast inline)                            | Nowe modyfikatory w `studnie/modal.css` zachowują szerokości/kolory; checklista §4.10                                                                                                                        |

### 4.12 Faza 1c (opcjonalna, osobny commit): `openPrzejsciaVisibilityPopup`

Ten sam wzorzec: `showModal` + `.modal`; `closePrzejsciaVisibilityPopup(containerId)` →
`closeModal()` + ponowny render kontenera (przez `onClose`). **Wykonać dopiero po akceptacji
4.1–4.11** — nie blokuje głównego celu.

---

## 5. Faza 2 — inline style w modalach `clientManager.js` (niski priorytet, niskie ryzyko)

Plik: `public/js/shared/clientManager.js`, modal `showClientsDb` (linie 116–136).

Mechanizm jest już zgodny (`showModal`). Do przeniesienia na istniejące klasy (bez zmian
wyglądu — klasy równoważne):

| Linia   | Inline style                                             | Zamiennik                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 119     | `max-width:1200px; width:95%; …`                         | klasa modyfikatorowa `.modal--clients { width:min(1200px, 95vw); max-height:90vh; display:flex; flex-direction:column; }` w `style.base.css`? **Nie** — wg wytycznej modyfikator trafia do wspólnego pliku tylko gdy używany 2+ razy; używany 1 raz → dodać w `public/js/`-adjacent: brak modułowego arkusza dla `clientManager` (shared). Decyzja: zostawić `max-width`/`width` inline (1 wystąpienie, kłamliwe byłoby tworzenie klasy) — **albo** dodać modyfikator `.modal--clients` w `style.responsive.css` obok `#offer-orders-modal .modal` (linia 506). Rekomendacja: **dodać w `style.responsive.css`** dla spójności z istniejącym wzorcem `.modal` overrides |
| 120–121 | `border-bottom`, `padding-bottom`, `font-size` na header | istniejące `.modal-header` (base) + `.text-muted` dla `(N)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 124–133 | search box                                               | istniejące `.form-input` (używane w tym pliku już w linii 215) zamiast 30 linii inline                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 134     | `flex:1; overflow-y:auto`                                | klasa `.modal-body { flex:1; overflow-y:auto; min-height:0; }` — sprawdzić, czy istnieje; jeśli nie, dodać do `style.responsive.css` obok `.modal-footer` (498)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

Ryzyko: niskie (kosmetyka). Testy: brak dedykowanych; weryfikacja przez `npm run test:quick`

- checklista wizualna (otwórz Baza klientów z oferty rur i studni).

---

## 6. Faza 3 — unifikacja `.form-input` / `.search-box` (niski priorytet)

Ustalenie audytu: gołej definicji nie ma — wszystko jest **scoped**:

- `.form-input`: `.wt-add-cell .form-input` (studnie.css:943), `.zlecenia-virtual-toolbar
.form-input` (zlecenia.css:598), `.login-box .form-input` (index.css:185).
- `.search-box`: `.zlecenia-header .search-box` (zlecenia.css:132,488), `.offer-product-search
.search-box` (style.base.css:1434), `.kartoteka-filter-bar .search-box` (responsive.css:78).

**Decyzja:** nie przenosić do `style.base.css` jako gołej klasy — to zmiana wizualna na
wszystkich ekranach na raz (ryzyko regresji > zysk). Zamiast tego:

1. Dokumentacyjnie: dodać do `docs/UI_GUIDELINES.md` wzorzec „scoped variant vs modifier":
   scoped selector w module jest akceptowalny, gdy dotyczy wyłącznie danego modułu; wspólne
   komponenty używają modyfikatorów `--<moduł>`.
2. Drobna unifikacja (jeżeli w ogóle): wyrównać wartości `padding`/`border-radius`/`font-size`
   między 3 definicjami `.form-input` do wspólnych tokenów — bez zmiany geometrii.

Testy: `tests/responsive/*.test.ts` (studnie/rury/zlecenia/dashboard) + `test:quick`.
Ryzyko: minimalne (żadnej zmiany selektorów ani wartości, wyłącznie wyrównanie do tokenów).

---

## 7. Faza 4 — redukcja inline `style=` w `public/partials/**` (najniższy priorytet, najwyższy koszt)

Pomiar: ~370 atrybutów `style=`; największe pliki: `studnie/step4-build-card.html` (68),
`studnie/modals.html` (67), `studnie/offer.html` (39), `rury/transport-modal.html` (38),
`studnie/step2-parameters.html` (40), `studnie/step3-offer.html` (65), `studnie/sidebar.html` (36),
`rury/step4-build-card.html` (68), `rury/step5-order.html` (18), `rury/step3-offer-summary.html` (17).

**Zasady partii (każda partia = osobny commit):**

1. Tylko **statyczne** style kosmetyczne: `padding`, `margin`, `color`, `border-radius`,
   `font-size`, `background` (stałe), `gap`, `justify-content`. Przenoszone do klas w
   `public/css/<moduł>.css` (z modyfikatorem jeśli dotyczy `.modal`/`.btn`).
2. **Nie ruszać** stylów dynamicznych: szerokości liczone w JS, kolory warunkowe, `position`
   w popupach z `LAYERS.*`, `transform` pozycjonujące.
3. Nie tworzyć klasy dla 1 wystąpienia — zostawić inline (wyjątek: reguła DRY nie dotyczy
   jednorazowych wartości; lepszy inline niż sztuczna klasa).
4. Po każdej partii: `npm run format` + `test:quick` + checklista wizualna dotkniętego ekranu.

Kolejność partii (od najmniejszego ryzyka): `summary-bar.html` (11) → `step1-client.html` (15) →
`pricelist.html` (rury 4 / studnie 19) → `offer.html` (rury 27) → `step2-products.html` (3) →
`sidebar.html` (36) → `step2-parameters.html` (40) → `step3-offer.html` (65) →
`modals.html` (67) → `transport-modal.html` (38) → `step4-build-card.html` (rury 68 / studnie 68) →
`step5-order.html` (18) → `step3-offer-summary.html` (17).

**Kryterium STOP dla fazy 4:** nie przekraczać 1 partii na commit; przy >15 min pracy na plik
rozdzielić plik na 2 partie. Faza 4 nie blokuje releasu — może być rozłożona w czasie.

---

## 8. Faza 5 — audyt XSS / `escapeHtml` (weryfikacja + domknięcie)

Zakres: wszystkie interpolacje do `innerHTML` w `public/js/shared/clientManager.js`
(potwierdzone: linia 174 `escapeHtml(q)`, 225 `escapeHtml(c.id)`; wiersze listy przez
`textContent` — bezpieczne; modal: interpolacje liczbowe `(N)` — bezpieczne).

Działania:

1. Przegląd każdej interpolacji w `clientManager.js`, `ui.js`, `wellTransitionsPopup.js`,
   `transitionRenderer.js`, `offerWellComponents.js`, `wellUI.js` (baza błędów #24):
   pola edytowalne (nazwy produktów, numery zamówień, nazwy klientów) **muszą** przez
   `escapeHtml`; atrybuty przez `escapeHtmlAttr`/`escapeJsStr` (baza #39).
2. Wszelkie znalezione luki → poprawka w ramach osobnych drobnych commitów `fix(ui): …`.
3. Dołączyć do `tests/security-regression.test.ts` (lub nowy przypadek) sanity-check:
   e.g. `escapeHtml('<img onerror=alert(1)>')` nie zawiera `<img` — jeśli taki test już jest,
   wyłącznie rozszerzyć o konkretne pole z poprawki.

Uwaga: to faza **weryfikacyjna** — jeśli audyt nic nie znajdzie, zamykamy bez zmian kodu.

---

## 9. Faza 6 — A11y sweep (`aria-label`, focus)

Zakres: przyciski ikonowe (`<button>` z `<i data-lucide>` i bez tekstu) bez `aria-label`
lub `title`. Wzorzec istnieje: `kartotekaHelpers.js:217` (`class="btn-icon btn-close-x"
aria-label="Zamknij"`), `clientManager.js:122`.

Działania:

1. `rg -l 'data-lucide' public/js` → dla każdego `<button>` zawierającego wyłącznie ikonę
   bez tekstu i bez `aria-label`/`title` → dodać `aria-label` (polski opis akcji).
2. Nie zmieniać wyglądu. Wyłącznie atrybuty.
3. Sprawdzić, czy nie ma `title` bez `aria-label` na przyciskach ikonowych — `aria-label`
   priorytetowy (a11y, kontrast narzędzi czytających).

Testy: brak testów DOM dla tego (brak jsdom) — weryfikacja grepowa (0 `<button` z samą ikoną
bez `aria-label`/`title`) + checklista manualna. Ryzyko: zerowe dla wyglądu.

---

## 10. Weryfikacja końcowa

Przed każdym commitem dowolnej fazy:

```bash
node -c public/js/<zmieniony-plik>.js      # składnia frontendu
npm run version:check                       # spójność wersji (obowiązkowe)
npm run format                              # Prettier
npm run validate                            # typecheck + lint + testy
npx jest tests/studnie/transitionsModals.test.ts   # tylko Faza 1
```

Po wszystkich fazach (przed zamknięciem planu):

```bash
npm run validate
npm run version:check
npm run encoding:check
npm run test:alignment      # regresja wyrównania kolumn Excel (jeśli dotknięty CSS)
```

## 11. Definicja „done" i archiwizacja

Plan uznany za zrealizowany, gdy:

- [ ] Faza 1: 3 modale przejść używają `modalCore.js`; `node -c` + testy `transitionsModals` zielone; checklista §4.10 odhaczona.
- [ ] Faza 2–3, 5–6: wykonane lub **świadomie odroczone z wpisem w CHANGELOG/debt** (dopuszczalne — faza 4 i 6 to długofalowe sprzątanie).
- [ ] Zero odwołań `style.css` (martwy plik) w aktywnych docs i `public/` (grep `rg "style\.css" docs public AGENTS.md` — wyłącznie `style.base/cards/responsive/utilities` i `style.cssText`).
- [ ] `docs/UI_GUIDELINES.md` zaktualizowane o wzorzec „scoped variant vs modifier" (§6).
- [ ] `npm run validate` + `version:check` + `encoding:check` przechodzą.

Po zakończeniu: `git mv docs/plans/2026-08-21-dostosowanie-do-wytycznych-ui-ux.md docs/plans/archive/`
(tylko gdy wszystkie fazy faktycznie domknięte; przy odroczonych fazach plan pozostaje aktywny
i prowadzimy postęp przez `task.md`/status na górze pliku).

## 12. Podsumowanie kolejności wykonania

| #   | Faza                                        | Priorytet  | Ryzyko             | Testy                                    |
| --- | ------------------------------------------- | ---------- | ------------------ | ---------------------------------------- |
| 1   | Modale przejść → modalCore                  | **wysoki** | niskie             | `transitionsModals.test.ts` + checklista |
| 2   | clientManager modal inline → klasy          | niski      | niskie             | `test:quick` + manual                    |
| 3   | Unifikacja `.form-input`/`.search-box`      | niski      | minimalne          | `tests/responsive/*`                     |
| 4   | Redukcja inline style w partials (partiami) | najniższy  | średnie (partiami) | `test:quick` + manual per partia         |
| 5   | Audyt XSS/escapeHtml                        | średni     | brak               | `security-regression`                    |
| 6   | A11y sweep                                  | niski      | zerowe             | grep + manual                            |

Zaczynamy od **Fazy 1** — największy zysk punktowy (ocena modali 3→8+) przy najniższym ryzyku
(dokumentowane API, izolowany plik, testy kontraktowe).
