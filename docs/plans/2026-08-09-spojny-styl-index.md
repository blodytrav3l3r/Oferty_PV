# Plan: Spójny styl index.html z design systemem SPA (kartoteka / zlecenia)

Data: 2026-08-09 | Status: DO WDROŻENIA (plan read-only) | Tryb: wdrożenie po akceptacji

> Plan finalny po weryfikacji kodu (czytanie: `index.html`, `index.css`,
> `style.base.css`, `style.cards.css`, `style.utilities.css`, `zlecenia.css`,
> `style.responsive.css`, `dashboard.js`, `aiDashboard.js`, plan 2026-08-06).
> Zasięg: WYŁĄCZNIE CSS + ewentualnie minimalny HTML. Bez zmian JS i bez zmian
> headera (to pokrywa `docs/plans/2026-08-06-spojny-pasek-gorny.md`, krok F).

## 1. Cel i tło

Strona logowania i pulpitu (`public/index.html` + `public/css/index.css`) dzieli
z SPA (`app.html#/kartoteka`, `app.html#/zlecenia`) ten sam rdzeń design systemu
(`style.base.css`, `style.cards.css`, `style.responsive.css`, `style.utilities.css`)
i te same tokeny `:root`. Rozbieżność leży w warstwie estetycznej `index.css`:
duże, „płynne" zaokrąglenia i mocny glassmorphism (login-box 20 px / blur 16 px,
user-hero pill 60 px, przyciski-pill 20 px) kontrastują z płaskimi, subtelnymi
kartami SPA (`.card` 12 px, `.modern-offer-card` 12 px, `.zlecenia-stat-card`
10 px + blur 10 px).

Cel: scalenie wzorców (Wariant B wg architekta) z elementami Wariantu A —
ujednolicenie radiusów/blurów przez tokeny `--radius-*`/`--blur-glass`,
dopasowanie interakcji hover do wzorca `.modern-offer-card`, usunięcie martwych
klas. Świadomie NIE ruszamy: headera (plan 2026-08-06 krok F), logiki JS,
`admin-stat-card` (już spójne z `.zlecenia-stat-card`).

## 2. Ustalenia — potwierdzone lokalizacje w repo

| #   | Ustalenie                                                                             | Lokalizacja (potwierdzona)                                                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| U1  | `index.css` i SPA używają tych samych tokenów; rozjazd estetyczny                     | `:root` tokenów: `style.base.css:3-184`; `--radius: 12px` / `--radius-sm: 8px` / `--radius-md: 16px` (148-151); `--glass` / `--glass-border` (139-140). `index.css` używa tych tokenów już częściowo (`--radius-md` w launch-card:305).                                                                                                    |
| U2  | `.login-box` radius 20 px + blur 16 px vs `.card` 12 px płaskie                       | `index.css:122-155` (radius 126, blur 128-129). Wzorzec SPA: `.card` `style.base.css:630-639` (12 px, `--bg-card`), `.zlecenia-stat-card` `zlecenia.css:16-51` (10 px, `--glass` + blur 10 px — glass jest akceptowanym wzorcem SPA).                                                                                                      |
| U3  | `.user-hero` pill radius 60 px (mobile: 20 px) — brak odpowiednika SPA                | `index.css:191-205` (radius 201, blur 202-203), override mobile `index.css:1949-1955` (radius 1953).                                                                                                                                                                                                                                       |
| U4  | `.launch-card` radius 16 px + mocny hover (-5 px, duży cień)                          | `index.css:298-401` (radius 305, hover 343-347). Wzorzec SPA: `.modern-offer-card` `style.cards.css:2-21` (12 px, hover subtelny: border + `0 8px 16px rgba(accent,0.1)`), `.offer-card` `style.base.css:1587-1603` (hover -2 px).                                                                                                         |
| U5  | **KORELTA RAPORTU**: `.ai-btn`/`.ai-ml-train-btn`/`.ai-ml-rollback-btn` NIE są martwe | `index.css:1322-1356` (ai-btn radius 20 px @1328), `1623-1651` (train radius 20 px @1630), `1653-1680` (rollback radius 20 px @1660). Używane przez `public/js/admin/aiDashboard.js:390-391, 875-876` → renderowane do `#ai-dashboard-container` (`index.html:510-512`, kontener tylko tu). Martwy jest WYŁĄCZNIE `.btn-hero`.             |
| U6  | `.btn-hero` martwy (0 użyć w JS/HTML)                                                 | `index.css:252-287`. Grep `public/` (JS+HTML): brak odwołań.                                                                                                                                                                                                                                                                               |
| U7  | Duplikaty `.role-admin/pro/user`: 2 pliki (nie 3), bazowy MARTWY                      | `style.base.css:779-795` vs `style.utilities.css:54-68`. Wszystkie 5 wejściówek (`index/app/kartoteka/rury/studnie.html`) ładuje `style.utilities.css` PO `style.base.css` → definicje z base są zawsze cieniowane (ten sam specificity, późniejszy source order). Kolor badge headera = utilities (warn/success/blue) — spójny już z SPA. |
| U8  | `.admin-stat-card` spójne z `.zlecenia-stat-card`                                     | `index.css:502-538` (10 px + blur 10 px) vs `zlecenia.css:16-51` (10 px + blur 10 px, gradient glass). Nie ruszamy.                                                                                                                                                                                                                        |
| U9  | `.badge-role` (tablea użytkowników) — pill 20 px; SPA MA pille                        | `index.css:724-750` (radius 729). Precedens pill w SPA: `.status-badge` `style.cards.css:317-326` (20 px @322), `.card-title .badge` `style.base.css:662-669` (20 px). Pille małe są spójne — zostają.                                                                                                                                     |
| U10 | `.ai-status-online/offline` — już usunięte                                            | Grep `public/`: 0 wyników (krok E planu 2026-08-06 wdrożony). Nie planujemy ponownie.                                                                                                                                                                                                                                                      |
| U11 | `style.responsive.css` ma reguły `.user-hero`/`.badge-role` — tylko w `@media print`  | `style.responsive.css:988, 1118` — kontekst druku, bez kolizji z ekranem.                                                                                                                                                                                                                                                                  |
| U12 | Inline `?v=1.11.5` w `index.html` — cache-bust zarządzany przez release               | `index.html:11-16, 86-89, 520-525`. Nie edytować ręcznie (AGENTS.md / CONTRIBUTING.md).                                                                                                                                                                                                                                                    |

## 3. Decyzje projektowe

| Decyzja                   | Wybór                                                                                                                                                                                                                                       | Uzasadnienie                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A: strategia plików**   | **Wariant B+**: zmiany wizualne WYŁĄCZNIE w `index.css`; w `style.base.css` tylko zmiany addytywne (2 nowe tokeny) + usunięcie udowodnionego martwego duplikatu `.role-*`                                                                   | `index.css` ładuje się tylko na `index.html` → zero ryzyka regresji dla modułów SPA. Tokeny w `:root` są addytywne (nic ich nie używa, dopóki nie odwołamy się w index.css). Usunięcie `.role-*` z base jest bezpieczne (U7: zawsze cieniowane). `style.cards.css` / `zlecenia.css` / `responsive.css` NIE ruszamy — ich wartości już odpowiadają docelowej estetyce, a edycja współdzielonych plików daje 0 zysku wizualnego. |
| **B: tokeny radius/blur** | Dodać do `:root` (`style.base.css:148-151`): `--radius-lg: 20px` oraz `--blur-glass: 10px`                                                                                                                                                  | `--radius-lg` nadaje nazwę utrzymywanym pillom (SPA ma pille 20 px — U9); `--blur-glass` (10 px) = wartość już używana przez `.zlecenia-stat-card` — konsolidacja blurów w jednym tokenie bez zmiany wyglądu SPA. Nie zmieniamy wartości istniejących tokenów (`--radius` 12 px itd.) — to byłaby zmiana propagująca się na wszystkie moduły.                                                                                  |
| **C: login-box**          | Radius 20 px → `var(--radius)` (12 px); blur 16 px → `var(--blur-glass)` (10 px); reszta (glass, border, shadow) bez zmian                                                                                                                  | `.card` SPA ma 12 px; glass pozostaje (wzorzec `.zlecenia-stat-card`). Efekt: ta sama „rodzina" co karty SPA, bez utraty charakteru.                                                                                                                                                                                                                                                                                           |
| **D: user-hero**          | Radius 60 px → `var(--radius)` (12 px); blur 20 px → `var(--blur-glass)`; override mobile 20 px → `var(--radius)`                                                                                                                           | Brak odpowiednika pill w SPA — hero staje się kartą jak reszta. Zmiana tylko estetyczna, brak wpływu na layout.                                                                                                                                                                                                                                                                                                                |
| **E: launch-card**        | Radius `--radius-md` (16 px) → `var(--radius)` (12 px); hover `translateY(-5px)` → `-2px`; hover shadow → wzorzec `.modern-offer-card` (`0 8px 16px rgba(accent-rgb,0.1), 0 2px 4px rgba(black-rgb,0.1)`); pasek akcentu `::before` zostaje | Scalanie interakcji z `.modern-offer-card` (subtelny lift). Pasek `::before` (3-4 px gradient) to czytelny akcent index, analogiczny do `.offer-status-indicator` w cards.css:27-43 — zostaje.                                                                                                                                                                                                                                 |
| **F: przyciski AI**       | `.ai-btn`, `.ai-ml-train-btn`, `.ai-ml-rollback-btn`: radius 20 px → `var(--radius-sm)` (8 px); USUNĄĆ `.btn-hero` (martwy, U6)                                                                                                             | Przyciski w SPA (`style.base.css:799-895`) używają `--radius-sm`. Pille przycisków 20 px odstają; 8 px = dokładnie wzorzec `.btn`. `.btn-hero` usuwamy w całości (0 użyć).                                                                                                                                                                                                                                                     |
| **G: dedup `.role-*`**    | Usunąć `style.base.css:779-795` (3 reguły); źródłem prawdy zostaje `style.utilities.css:54-68`                                                                                                                                              | U7: w każdej wejściówce utilities wygrywa kaskadą — usunięcie nie zmienia niczego wizualnie, czyści duplikat. Uwaga: w razie przyszłej zmiany kolejności ładowania `.role-*` nadal ma działającą definicję w utilities.                                                                                                                                                                                                        |
| **H: pille małe**         | Zostają jako pille; radius 20 px → `var(--radius-lg)` (badge-role:729, launch-btn-label:390, dash-role-badge:1889, recycled-badge:476, admin-edit-badge:954)                                                                                | SPA ma pille (U9) — kształt jest spójny; tokenizacja tylko nadaje nazwę wartości. Opcjonalne (krok niski priorytet).                                                                                                                                                                                                                                                                                                           |
| **I: HTML / JS / header** | Zero zmian HTML, zero zmian JS, header poza zakresem                                                                                                                                                                                        | Wszystko osiągalne samym CSS. Header konsoliduje plan 2026-08-06 krok F (osobna iteracja).                                                                                                                                                                                                                                                                                                                                     |

## 4. Zakres zmian — kroki implementacyjne

### Krok 1 — tokeny radius/blur (TERAZ, fundament)

- **Plik**: `public/css/style.base.css`, blok `:root` (linie **148-151** obok istniejących `--radius*`)
- **Zmiana**: dodać dwie linie:
    ```css
    --radius-lg: 20px;
    --blur-glass: 10px;
    ```
- **Dlaczego**: addytywne tokeny — pojedyncze źródło prawdy dla pil li (20 px) i bluru glass (10 px, wartość już używana przez `.zlecenia-stat-card`). Nic nie zmieniają, dopóki nie zostaną użyte w kroku 2-4.
- **Priorytet**: wysoki (fundament). **Ryzyko**: zerowe (dodanie nowych zmiennych).
- **Weryfikacja**: `npm run format`; `npm run encoding:check` (UTF-8).

### Krok 2 — duże kontenery: login-box, user-hero, launch-card (TERAZ)

- **Plik**: `public/css/index.css`
- **Zmiany** (wszystkie czysto estetyczne, bez zmian layoutu):
    1. `.login-box` (linie **122-155**): `border-radius: 20px` (126) → `var(--radius)`; `-webkit-backdrop-filter: blur(16px) saturate(1.2)` / `backdrop-filter: blur(16px) saturate(1.2)` (128-129) → `blur(var(--blur-glass)) saturate(1.2)`.
    2. `.user-hero` (linie **191-205**): `border-radius: 60px` (201) → `var(--radius)`; `blur(20px)` (202-203) → `blur(var(--blur-glass))`.
    3. `.user-hero` override mobile (**1949-1955**): `border-radius: 20px` (1953) → `var(--radius)`.
    4. `.launch-card` (linie **298-401**): `border-radius: var(--radius-md)` (305) → `var(--radius)`; hover (**343-347**): `transform: translateY(-5px)` → `translateY(-2px)`, `box-shadow: 0 20px 40px -10px rgba(var(--black-rgb), 0.5)` → `box-shadow: 0 8px 16px rgba(var(--accent-rgb), 0.1), 0 2px 4px rgba(var(--black-rgb), 0.1);` (wzorzec `.modern-offer-card`).
    5. (Opcjonalnie, krok 6) pasek `::before` (316-341) zostaje bez zmian.
- **Dlaczego**: U2-U4 — trzy największe rozbieżności estetyczne; po scaleniu karty index mają te same 12 px i subtelny hover co SPA.
- **Priorytet**: wysoki. **Ryzyko**: niskie (kosmetyka).
- **Weryfikacja**: `npm run format`; ręcznie — login, pulpit po zalogowaniu, hover na karty, mobile ≤640 px.

### Krok 3 — przyciski: re-tokenizacja AI + usunięcie martwego `.btn-hero` (TERAZ)

- **Plik**: `public/css/index.css`
- **Zmiany**:
    1. `.ai-btn` (**1322-1339**): `border-radius: 20px` (1328) → `var(--radius-sm)`.
    2. `.ai-ml-train-btn` (**1623-1639**): `border-radius: 20px` (1630) → `var(--radius-sm)`.
    3. `.ai-ml-rollback-btn` (**1653-1669**): `border-radius: 20px` (1660) → `var(--radius-sm)`.
    4. Usunąć cały blok `.btn-hero` (**252-287**) — 6 reguł, 0 użyć (U6).
- **Dlaczego**: U5-U6 — przyciski AI żyją (admin dashboard) i powinny dzielić radius 8 px z `.btn` SPA; `.btn-hero` to martwy kod.
- **Priorytet**: średni. **Ryzyko**: niskie; przyciski AI zmieniają wygląd tylko na pulpicie admina (kontener wyłącznie w `index.html`).
- **Weryfikacja**: `npm run format`; ręcznie — panel admina (sekcja AI/ML), radius przycisków „Filtruj", „Uruchom Learning Cycle", „Uruchom trening ML", „Rollback modelu".

### Krok 4 — dedup `.role-*` w base (TERAZ, jedyne usunięcie we współdzielonym pliku)

- **Plik**: `public/css/style.base.css` (linie **779-795**)
- **Zmiana**: usunąć reguły `.role-admin { }`, `.role-pro { }`, `.role-user { }` (sekcja „User Roles").
- **Dlaczego**: U7 — we wszystkich 5 wejściówkach `style.utilities.css:54-68` wygrywa kaskadą (ten sam specificity, późniejszy `<link>`). Usunięcie nie zmienia wyglądu żadnego modułu; znika duplikat.
- **Priorytet**: średni (czystość, nie wizualnie). **Ryzyko**: niskie — ale wymaga uwagi przy przyszłych zmianach kolejności `<link>` (patrz Ryzyka R2).
- **Weryfikacja**: `npm run format`; ręcznie — badge roli w headerze index i SPA (Studnie/Rury/Kartoteka/Zlecenia) zachowuje kolory warn/success/blue.

### Krok 5 — (opcjonalny, niski priorytet) tokenizacja pil li małych

- **Plik**: `public/css/index.css`
- **Zmiany**: `border-radius: 20px` → `var(--radius-lg)` w: `.badge-role` (729), `.launch-btn-label` (390), `.dash-role-badge` (1889), `.recycled-badge` (476), `.admin-edit-badge` (954).
- **Dlaczego**: pille pozostają (wzorzec SPA U9); token daje nazwę wartości i spójność z krokiem 1. Zmiana czysto kosmetyczna, identyczna wizualnie.
- **Priorytet**: niski. **Ryzyko**: zerowe (te same wartości). Można pominąć bez szkody dla celu.

### Krok 6 — (wyraźnie NIE w tym zadaniu)

- Nie ruszamy: `style.cards.css` (`.modern-offer-card` to już wzorzec), `zlecenia.css` (wzorzec), `style.responsive.css` (U11 — druk), headera (`index.css:1855-1902` — krok F planu 2026-08-06), żadnych plików JS, żadnych `?v=` w HTML (U12).

## 5. Kolejność wdrożenia i zależności

| Kolejność | Krok                                              | Zależność | Uzasadnienie                                                                                               |
| --------- | ------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| 1         | **Krok 1** (tokeny w `:root`)                     | brak      | Fundament — kroki 2-3-5 odwołują się do `--radius-lg` / `--blur-glass`.                                    |
| 2         | **Krok 2** (kontenery)                            | Krok 1    | Największy efekt wizualny; czysto index.css.                                                               |
| 3         | **Krok 3** (przyciski AI + usunięcie `.btn-hero`) | Krok 1    | Przyciski używają `--radius-sm` (istniejący token) — zależność tylko miękka; można równolegle z krokiem 2. |
| 4         | **Krok 4** (dedup `.role-*`)                      | brak      | Niezależny; jedyna zmiana we współdzielonym pliku poza addytywnym krokiem 1.                               |
| 5         | **Krok 5** (pille, opcjonalny)                    | Krok 1    | Tani; można dołączyć do kroku 2 w jednym commicie.                                                         |

Rezultat: **kroki 1-4 = TERAZ** (minimalny zestaw), krok 5 = opcjonalny w tej samej iteracji.

## 6. Strategia testów

- **Składnia/format**: `npm run format` (Prettier, single quotes, 4 spacje) — zawsze na końcu; `npm run format:check` do weryfikacji.
- **Kodowanie**: `npm run encoding:check` (nowe polskie komentarze w UTF-8 bez BOM).
- **Lint/testy**: `npm run lint:frontend` + `npm run test:quick` (sanity — zmiany CSS nie wpływają na TypeScript; `npm run validate` pełne przy commicie).
- **Testy ręczne (przeglądarka, po `npm run dev`)**:
    1. Strona logowania: `.login-box` — radius 12 px, delikatny blur (10 px), hover bez przesunięcia layoutu.
    2. Pulpit po zalogowaniu (user i admin): `.user-hero` — płaska karta 12 px; `.launch-card` — hover -2 px + subtelny cień, pasek akcentu `::before` działa.
    3. Panel admina: `.admin-stat-card` bez zmian; przyciski AI (Filtruj, Learning Cycle, Trening ML, Rollback) — radius 8 px; tabela użytkowników — `.badge-role` bez zmian (pille 20 px).
    4. Badge roli w headerze (index + SPA): kolory warn/success/blue bez zmian (po kroku 4).
    5. Responsywność: ≤640 px (hero mobile), ≤480 px (login-box padding, launch-card kolumnowo); `prefers-reduced-motion` bez animacji.
    6. SPA sanity: Studnie / Rury / Kartoteka / Zlecenia — wygląd identyczny jak przed zmianą (regresja kroku 4: badge roli w headerach modułów).

## 7. Ryzyka i mitigacje

| Ryzyko                                                                                     | Mitigacja                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1: Zmiana wyglądu przycisków AI (krok 3) — admin dashboard odbierany jako „inny"          | Świadoma zmiana zgodna z celem (scalerie z `.btn` SPA); łatwo odwracalna (1 wartość na regułę); dotyczy wyłącznie kontenera `#ai-dashboard-container` w `index.html`.                              |
| R2: Usunięcie `.role-*` z base (krok 4) — w przyszłości strona ładująca base bez utilities | Definicja nadal istnieje w `style.utilities.css` (wygrywająca dziś w każdej wejściówce — U7). Ryzyko wyłącznie przy dodaniu NOWEJ strony bez utilities.css; notatka w commicie/CHANGELOG.          |
| R3: Regresja wizualna SPA przy edycji współdzielonych plików (base.css :root)              | Krok 1 jest czysto addytywny (2 nowe tokeny, zero odwołań z zewnątrz); krok 4 usuwa reguły udowodnione jako cieniowane. `style.cards.css`/`zlecenia.css`/`responsive.css` w ogóle nie ruszane.     |
| R4: `--blur-glass` duplikuje hardcode `blur(10px)` w `zlecenia.css:31-32`                  | Świadomy kompromis minimalnego diffa — tokenizacja zlecenia.css to zmiana współdzielonego pliku bez zysku wizualnego; odłożona (można w przyszłej iteracji przy okazji innych zmian w zleceniach). |
| R5: Inline `?v=1.11.5` — cache przeglądarki nie odświeży CSS przy wdrożeniu                | Zmiany CSS wejdą w życie po kolejnym release (cache-bust `?v=` zsynchronizowany z VERSION); podczas testów dev wystarczy twarde odświeżenie (Ctrl+F5). NIE edytować `?v=` ręcznie (U12).           |

## 8. Kryteria sukcesu

- [ ] `.login-box`: radius 12 px (`var(--radius)`), blur 10 px (`var(--blur-glass)`), bez zmiany layoutu.
- [ ] `.user-hero`: karta 12 px (desktop i mobile ≤640 px), blur 10 px.
- [ ] `.launch-card`: radius 12 px, hover -2 px z subtelnym cieniem (wzorzec `.modern-offer-card`), pasek akcentu aktywny.
- [ ] Przyciski AI (Filtruj / Learning Cycle / Trening ML / Rollback): radius 8 px (`var(--radius-sm)`).
- [ ] `.btn-hero` usunięty; grep `public/` — 0 odwołań.
- [ ] `.role-*` zdefiniowane wyłącznie w `style.utilities.css`; badge roli w headerze index i SPA bez zmiany kolorów.
- [ ] Tokeny `--radius-lg` / `--blur-glass` obecne w `:root` (`style.base.css`).
- [ ] Brak zmian w JS, HTML (poza ewentualnym formatowaniem), `?v=`, `style.cards.css`, `zlecenia.css`, `style.responsive.css`.
- [ ] `npm run format` wykonany; `npm run format:check`, `npm run encoding:check`, `npm run lint:frontend`, `npm run test:quick` zielone; moduły SPA wyglądają identycznie jak przed zmianą.
