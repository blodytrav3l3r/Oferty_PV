# Plan migracji do ES Modules (TASK-047)

**Status:** NOWY — dokument planu + pierwszy krok (2 moduły ESM).
**Data:** 2026-08-19
**Priorytet:** P4 (audyt FA-3, LOW)
**Zależności:** TASK-045 (shared core), TASK-027 (modalCore), TASK-008 (kolizje globali)

## Cel

Zmniejszenie liczby globali `window.*` (aktualnie **912** w 199 plikach `public/js/`) przez
stopniową migrację do natywnych modułów ES (ESM). Migracja big-bang niemożliwa (748 globali
wg audytu, dziś 912 po dodaniu nowych modułów) — realizowana etapami per-moduł.

## Zasada przewodnia (wzorzec PASS)

Każdy moduł przechodzi 4 stadia, zawsze wstecznie kompatybilne:

1. **`window.X`** — globalny dostęp (status quo).
2. **Namespace** — grupowanie pokrewnych globali w jeden obiekt (`window.importExportToolbar`).
3. **Shared API** — wyodrębnienie wspólnego rdzenia do `public/js/shared/` (TASK-045/046 wzorzec: `createOfferNotesGenerator`, `createOrderSelectionController`).
4. **ES module** — plik z `export` + `import`, ładowany przez `<script type="module">`.
5. **Dynamic import** — `import()` w runtime dla niekrytycznych ścieżek (StorageService.js to wzorzec).

Moduły ESM ładują się przez `<script type="module" src="...">`. **Eksportowane symbole NIE
trafiają na `window`** — to jest sedno redukcji globali. Globalne API dla starszych plików
(niezmigrowanych) utrzymywane przez mostek: plik ESM na końcu rejestruje `window.x = x`
w sekcji `/* Bridge dla legacy */`, usuwany po zmigrowaniu wszystkich zależnych.

## Kolejność migracji per-moduł

Priorytet: najpierw moduły bez zależności cyklicznych i bez mutacji stanu globalnego.

| Etap | Moduł                                                    | Plik                       | Globali | Uwagi                                          |
| ---- | -------------------------------------------------------- | -------------------------- | ------- | ---------------------------------------------- |
| 1    | `escapeHtml`/`escapeHtmlAttr`/`escapeJsStr`              | `shared/escapeHtml.js`     | 3       | czyste funkcje, zero zależności, ~40 callerów  |
| 2    | `modalCore` (showModal/closeModal/trapFocus/untrapFocus) | `shared/modalCore.js`      | 4       | core modalów (TASK-027), zależny od escapeHtml |
| 3    | `toast`                                                  | `shared/toast.js`          | 2       | showToast/showToastError                       |
| 4    | `fetchJson`                                              | `shared/fetchJson.js`      | 1       | zależny od authHeaders                         |
| 5    | `debounce`/`throttle`                                    | `shared/debounce.js`       | 2       | czyste funkcje                                 |
| 6    | `storageService`                                         | `shared/StorageService.js` | 1       | wzorzec PASS st. 5, zamknięcie cyklu           |
| 7..n | moduły rury/studnie                                      | per katalog                | reszta  | deduplikacja przez shared API najpierw         |

**Reguła kolejności:** nigdy nie migruj modułu, który ma zależnych niezmigrowanych i
odwrotnie — zaczynaj od liści (funkcje czyste), kończ na korzeniach (inicjalizacja).

## Pierwszy krok (wykonany w tym tasku)

- `public/js/shared/escapeHtml.js` — ESM: `export function escapeHtml/escapeHtmlAttr/escapeJsStr`.
  Mostek legacy na końcu pliku. Usunięcie definicji z `shared/ui.js` (zostają tam inne globalne).
- `<script type="module" src="js/shared/escapeHtml.js?v=...">` w 6 wejściówkach HTML
  (index, app, studnie, rury, kartoteka, zlecenia) PRZED `shared/ui.js`.

### Ryzyka pierwszego kroku

- **Kolejność ładowania:** `type="module"` wykonuje się po defer — wszystkie skrypty defer
  czekają na DOM, więc mostek `window.escapeHtml` ustawiany przed ich wykonaniem. Weryfikacja
  przez E2E (testy istniejące nie sprawdzają `escapeHtml`).
- **Strict mode:** moduły ESM są zawsze strict — kod w zmigrowanych plikach musi działać w strict.
  `escapeHtml*` to czyste funkcje — bezpieczne.
- **CSP:** Helmet `scriptSrc: ["'self'", "'unsafe-inline'"]` pozwala `type="module"` z `'self'`.

## Weryfikacja po każdym etapie

1. `npm run test:quick` — smoke (1907 testów).
2. `npm run lint:frontend` + `node -c <plik>` dla plików ESM.
3. `npm run typecheck:frontend` — pliki `.js` w `public/js` (tsconfig.frontend.json include).
4. Ręcznie: logowanie + otwarcie modułu (przeglądarka), brak błędów w konsoli.
5. Licznik globali maleje (`window.X` grep).

## Kryteria akceptacji (TASK-047)

- [x] Dokument planu migracji (ten plik).
- [x] 2 moduły jako ESM (`escapeHtml`, `modalCore`).

## Rollback

Revert per-etap (cofnięcie `<script type="module">` + przywrócenie definicji w `ui.js`).
