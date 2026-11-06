# Utrzymywalność, pliki i dokumentacja

## A11 · Inwentaryzacja automatyczna

AST z lokalnego TypeScript przeanalizował TS/JS/CJS/MJS w src, public, scripts, tests, prisma i server.ts z pominięciem public/vendor. W public skan obejmuje też obecne lokalnie aktywa generowane, dlatego liczniki sygnałów nie są baseline do ratchetu. W src naliczono 1750 ciał funkcji, 18 węzłów any, 17 pustych catch i 3 wywołania RawUnsafe (kontekst w raporcie bezpieczeństwa). W public naliczono 624 przypisania innerHTML, 2612 zapisów window.<nazwa> i 1453 puste catch w tym zakresie. To sygnały do weryfikacji. Pusty catch może implementować świadome best effort, a innerHTML nie dowodzi XSS.

| Plik źródłowy                         | Linie fizyczne |
| ------------------------------------- | -------------: |
| public/css/studnie.css                |           6117 |
| public/css/index.css                  |           4023 |
| public/js/shared/pricelistVersions.js |           3527 |
| public/css/style.base.css             |           3066 |
| public/css/style.responsive.css       |           2735 |
| public/js/shared/draftAutosave.js     |           2724 |
| public/js/care/carePanel.js           |           2657 |
| public/js/studnie/excelCopyPaste.js   |           2149 |
| public/js/studnie/solverAutoSelect.js |           1655 |
| public/css/studnie/modal.css          |           1525 |
| public/js/shared/dashboard.js         |           1505 |
| src/services/careService.ts           |           1486 |
| src/routes/offers/studnieCrud.ts      |           1439 |
| public/js/studnie/orderCrud.js        |           1384 |
| public/css/rury.css                   |           1294 |

| Funkcja / blok       | Plik:linia                                | Linie AST |
| -------------------- | ----------------------------------------- | --------: |
| <callback>           | public/js/shared/pricelistVersions.js:7   |      3521 |
| runJsAutoSelection   | public/js/studnie/solverAutoSelect.js:402 |      1208 |
| <callback>           | public/js/spa/zlecenia.js:7               |      1063 |
| <callback>           | public/js/studnie/mlDualRanking.js:17     |      1051 |
| <callback>           | public/js/spa/router.js:16                |       988 |
| <callback>           | public/js/shared/resumeDrafts.js:14       |       882 |
| <callback>           | public/js/shared/iconsSlim.js:9           |       803 |
| <callback>           | public/js/studnie/telemetryBridge.js:15   |       786 |
| renderWellPrzejscia  | public/js/studnie/wellTransitions.js:299  |       758 |
| _excelHandlePaste    | public/js/studnie/excelCopyPaste.js:395   |       695 |
| _excelRenderTbody    | public/js/studnie/excelTableBody.js:142   |       687 |
| <callback>           | public/js/admin/aiDashboardMl.js:1        |       677 |
| populateZleceniaForm | public/js/studnie/orderZleceniaForm.js:80 |       625 |
| <callback>           | public/js/shared/printModal.js:25         |       610 |

- Q-01. Router, menedżer cen i Excel łączą stan z renderowaniem. Duże funkcje konkretnie komplikują zmianę semantyki edycji, np. obsługa paste w excelCopyPaste.js:395 i render w excelTableBody.js:142. Priorytet nadać granicom danych, po regresjach z FE-07 i FE-10.
- Q-02. Podwójna ścieżka usuwania Studnie i różne reguły audytu/ownership udowodnione w BUS-02. Ujednolicić kontrakt i zlikwidować duplikat dopiero po sprawdzeniu obu mountów.
- Q-03. Nieużywane eksporty, biblioteki i pliki bez literalnego importu pozostają N/A bez analizy osiągalności przez HTML, eventy, aliasy i operacje. Poprzedni porządek Hermes jest widoczny w working tree. .hermes ma aktywne powiązania CLI, .claude jest lokalne, public/dist oraz cache Graphify są generowane. Brak wskazania bezpiecznego usunięcia śledzonego pliku na podstawie samego grep. Katalogi lokalne należy odfiltrować z dystrybucji zgodnie z SEC-06.
- Q-04. src/utils/fts5Queue.ts nadal komunikuje historyczne pojęcie FTS5, mimo obsługi PostgreSQL. Potencjalna poprawa nazewnictwa po weryfikacji konsumentów.

## A12 · Dokumentacja

Przejrzano README, CONTRIBUTING, AGENTS, aktualny standard DB, instrukcje instalacji i deployu, reguły testów, architekturę, kontekst inwariantów i historyczne ADR. Spójne elementy to PostgreSQL-only, osobne role, migracje deploy, bootstrap cenników, ostrzeżenia dotyczące backupu i odrębne warianty Windows/Linux. Czytanie tych opisów nie potwierdza stanu instalacji.

- DOC-01 P1. CONTRIBUTING.md:110–126 zaleca db push --accept-data-loss dla ścieżki legacy. README.md:253 i docs/SYSTEM_INVARIANTS.md:51–53 wyłączają db push jako ścieżkę wdrożeniową. Przeniesienie fragmentu do kontekstu historycznego i weryfikacja linków ograniczą ryzyko zastosowania destrukcyjnej instrukcji.
- DOC-02 P2. AGENTS.md odsyła do docs/AUTONOMY_CONTRACT.md. Pliku nie znaleziono w bieżącym checkout. Dokument reguł albo odwołanie wymaga synchronizacji.
- API-05. API docs mają jedno udokumentowane działanie i błędną nazwę cookie.
- OPS-01. Termin DEPLOYED w workflow może tworzyć mylne przekonanie o ukończeniu wdrożenia.
- Dokumenty archiwalne SQLite zachowują status historyczny. Wzmianka archiwalna nie jest błędem produkcyjnego kierunku.
