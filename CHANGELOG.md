# CHANGELOG

Wszystkie znaczące zmiany w tym projekcie są dokumentowane w tym pliku.

---

## [1.8.0](https://github.com/blodytrav3l3r/Oferty_PV/compare/v1.7.0...v1.8.0) (2026-07-19)


### Features

* **studnie:** add Excel column visibility popup with DN grid and persistence ([62ae04d](https://github.com/blodytrav3l3r/Oferty_PV/commit/62ae04ddb7838112abcea40b9ebf0c269374403f))
* **studnie:** powiaz widocznosci przejsc z Excelem ([7484699](https://github.com/blodytrav3l3r/Oferty_PV/commit/7484699b25fe63621082a96cf6baac22eac7fb9d))


### Bug Fixes

* **studnie:** poprawki UI listy studni i lock toasty ([277b739](https://github.com/blodytrav3l3r/Oferty_PV/commit/277b739531d49ce608cdebf67cd0028c2cc40f67))
* **studnie:** wizualny podziaL konusa na czesc stozkowa i pierscien laczacy ([8f04cea](https://github.com/blodytrav3l3r/Oferty_PV/commit/8f04cead465b505217054f0cb768890b9022bfab))

## [1.7.0](https://github.com/blodytrav3l3r/Oferty_PV/compare/v1.6.0...v1.7.0) (2026-07-19)

### Features

- **clients:** dodanie numeru klienta (clientNumber) w calym stacku ([63b0e35](https://github.com/blodytrav3l3r/Oferty_PV/commit/63b0e356e0f118ad7f6513d59fcd3c54cc77981e))
- **import-export:** eksport/import zamowien XLSX i JSON ([02703a1](https://github.com/blodytrav3l3r/Oferty_PV/commit/02703a1855e0a036dd78bd94fdc504293535a4c7))
- **kartoteka:** dodanie filtrow daty i uzytkownika z popoverem ([10df453](https://github.com/blodytrav3l3r/Oferty_PV/commit/10df453ef505964d393433ddd7ba5b8cd3b0384d))
- **kartoteka:** generalizacja notifyOrderMutation po kazdej mutacji zamowienia ([ab02ad2](https://github.com/blodytrav3l3r/Oferty_PV/commit/ab02ad258d00a839334447d4fd87ab7bffdeac2f))
- **kartoteka:** wyszukiwanie FTS5, naprawa widocznosci zamowien studni, numer klienta ([add9e82](https://github.com/blodytrav3l3r/Oferty_PV/commit/add9e829cbd176db9a191f08fd0742fd145e6b45))
- **rury:** zamowienia czastkowe — ilosciowe sledzenie i karta budowy ([64b120b](https://github.com/blodytrav3l3r/Oferty_PV/commit/64b120b1d23953582166dadf3c93f1e2e8af23e2))
- **studnie:** dodanie ikon cech studni w zestawieniu ofertowym ([70b6c99](https://github.com/blodytrav3l3r/Oferty_PV/commit/70b6c9947384004ebda37a0d78e06992398d19f8))
- **studnie:** dodanie ilości i średniej ceny studni w popup rabatów ([4ffdb07](https://github.com/blodytrav3l3r/Oferty_PV/commit/4ffdb07835d181cd00af5ab8b26cbbff55199e88))
- **zlecenia:** skalowanie kartoteki zlecen produkcyjnych - search API, cursor pagination, cache ([15fa4d9](https://github.com/blodytrav3l3r/Oferty_PV/commit/15fa4d9d26b49997db763428860186ca428e5268))

### Bug Fixes

- **kartoteka:** brakujacy skrypt pvSalesHelpers.js w kartoteka.html - ReferenceError: openPrintModal is not defined ([e9ea7fa](https://github.com/blodytrav3l3r/Oferty_PV/commit/e9ea7fa876f6ee3a44a146255a079e807eb60dd4))
- **kartoteka:** jednolity rozmiar ikon i przyciskow w trybie kompakt ([d0037f9](https://github.com/blodytrav3l3r/Oferty_PV/commit/d0037f9a30ac250f155e438f241f18f4b6ea6ee2))
- **kartoteka:** loadOrdersMap w tle nie blokuje renderowania ([3ad34fa](https://github.com/blodytrav3l3r/Oferty_PV/commit/3ad34fa0e6a71c9b43e867239667229629d06131))
- **kartoteka:** naprawa bledow z analizy statycznej - faza 1-5 ([04a3bf2](https://github.com/blodytrav3l3r/Oferty_PV/commit/04a3bf2ccf233b317b23146f8f5a7c0955285823))
- naprawa zniekształconych polskich znaków w komentarzach i usunięcie BOM z dokumentacji ([27e1636](https://github.com/blodytrav3l3r/Oferty_PV/commit/27e1636c6bdb427755bd3080a9a7da20e593991f))
- przeniesienie let anyRed poza blok if (ReferenceError) ([21cc339](https://github.com/blodytrav3l3r/Oferty_PV/commit/21cc3391ef6ec075ca6cdc42ad4bc576622ae0c1))
- **studnie:** domyślnie ukryte typy przejść w konfiguratorze ([d63aa27](https://github.com/blodytrav3l3r/Oferty_PV/commit/d63aa27ece34e5fcdd2cd16ce41d62e7bdb416e8))
- **studnie:** naprawa przycisku run w excel - SVG 16x16 zamiast Unicode, fix podwójnego style ([4470f64](https://github.com/blodytrav3l3r/Oferty_PV/commit/4470f64fca8fc722c5f4074360275086322361ea))
- **studnie:** naprawa zniekształconych polskich znaków w karcie budowy ([affcdf4](https://github.com/blodytrav3l3r/Oferty_PV/commit/affcdf439d78da541565d66bd7cf0b94f157b860))
- **studnie:** pasek przewijania karty budowy przy krawedzi strony ([d45bfe6](https://github.com/blodytrav3l3r/Oferty_PV/commit/d45bfe61f3ba903c05804a6e5f66bf6ec4210dbf))
- **studnie:** przywrocenie oryginalnej struktury HTML w populateZleceniaForm ([059867d](https://github.com/blodytrav3l3r/Oferty_PV/commit/059867d28bb769987abecea42e606130e2cced57))
- **studnie:** scrollbar karty budowy - szerokosc 6px i scrollbar-width:thin ([0add25a](https://github.com/blodytrav3l3r/Oferty_PV/commit/0add25a04bed24f7db28831c62ece3732ce96735))
- **studnie:** timeout w DP ringOptimizer (250ms) i backtracking wellSolver (100ms) - zabezpieczenie przed zawieszeniem ([9446312](https://github.com/blodytrav3l3r/Oferty_PV/commit/9446312efcad0eedcd3e5f5d8b273d662f8f0b9e))
- **studnie:** zamiana ikon Lucide na badge tekstowe w zestawieniu ofertowym ([5947faf](https://github.com/blodytrav3l3r/Oferty_PV/commit/5947faf00322fd076251fb8c2196596625271198))
- **ui:** ujednolicono wysokość ikon w kaflach nawigacji (21x21px) ([6e89c04](https://github.com/blodytrav3l3r/Oferty_PV/commit/6e89c04d9a4690620cc798b8961e4138577c3fd1))

## [1.6.0](https://github.com/blodytrav3l3r/Oferty_PV/compare/v1.5.0...v1.6.0) (2026-07-15)

### Features

- **seed:** auto-sync seed JSON z baza danych po kazdej zmianie cennika ([2011d88](https://github.com/blodytrav3l3r/Oferty_PV/commit/2011d8896abf646b15b52dce2336b10c56f37a86))
- **studnie:** dymek z rozpiska obliczen wkładki PEHD - dno/sciany dla dennicy, kwadrat dla płyt ([e186577](https://github.com/blodytrav3l3r/Oferty_PV/commit/e18657734c4c12bf0083ce9271904b82d73d933b))
- **studnie:** uwzględnienie odpadu kwadratowego w wykroju wkładki PEHD dla elementów płytowych ([91ccc4a](https://github.com/blodytrav3l3r/Oferty_PV/commit/91ccc4a315f3f32d9590994edae12d5fbd5745e7))

### Bug Fixes

- **studnie:** odpad kwadratowy dna dennicy/stycznej - area dzielone na dno (x4/pi) + sciany (x1) ([a524e4a](https://github.com/blodytrav3l3r/Oferty_PV/commit/a524e4a1217e7fb939b20f739dd967184b2492f2))
- **studnie:** pierscien_odciazajacy bez wykroju kwadratowego - pierscien to nie plyta ([647a8e6](https://github.com/blodytrav3l3r/Oferty_PV/commit/647a8e615f48528ea203da23598e01c6efb4080e))

## [1.5.0](https://github.com/blodytrav3l3r/Oferty_PV/compare/v1.4.0...v1.5.0) (2026-07-07)

### Features

- **ml:** implementacja AI pipeline dla konfiguratora studni ([5fb0ff3](https://github.com/blodytrav3l3r/Oferty_PV/commit/5fb0ff30c9e62a53a09a833586c3ce41f1a1f28a))
- **telemetry:** konsolidacja telemetrii AI — usunięcie popupu, przekierowanie na Express, aktywacja zdarzeń ([b1156fc](https://github.com/blodytrav3l3r/Oferty_PV/commit/b1156fcbc4d2f1a7b714667cd29c878d68e3e125))

### Bug Fixes

- **audit): chunkowany cleanup logów + indeks createdAt; fix(ui:** PvImportExportToolbar TS error ([1dd0c12](https://github.com/blodytrav3l3r/Oferty_PV/commit/1dd0c12d50eae39e7bf040ddba675a3286c2fa7e))
- **studnie:** wyrównanie kolumn w pustym wierszu tabeli Excel — 5 gołych `<select disabled>` zastąpiono `_excelOverlaySelectHtml` z `disabled` ([#16](https://github.com/blodytrav3l3r/Oferty_PV/issues/16))

## [1.4.0](https://github.com/blodytrav3l3r/Oferty_PV/compare/v1.3.0...v1.4.0) (2026-07-06)

### Features

- **offers:** import/eksport oferty z feature flag ([3714b0a](https://github.com/blodytrav3l3r/Oferty_PV/commit/3714b0a17849d786b5bbc0a43aef7f81e8ecc1da))
- **seed:** dodanie skryptu normalize-seed-studnie.mjs do ujednolicania nazw pol w seed studni ([0477003](https://github.com/blodytrav3l3r/Oferty_PV/commit/047700342b78f6a623addea4d9ec872f9783607a))
- **studnie:** walidacja seed przy starcie backendu — wykrywa stare polskie klucze ([1ba201c](https://github.com/blodytrav3l3r/Oferty_PV/commit/1ba201cb15bf512c018c4f3df181652cec6c3560))

### Bug Fixes

- **api:** kolejność spread w ruryCrud — DB items mają priorytet nad JSON ([c155fe3](https://github.com/blodytrav3l3r/Oferty_PV/commit/c155fe3ec6a6ad1e87f3d97694bfecb889681c82))
- **rury:** eliminacja duplikacji zt i utraty transport zero ([5fc4d02](https://github.com/blodytrav3l3r/Oferty_PV/commit/5fc4d02ee4fcf56073278e092c67120053a40c31))
- **rury:** pehd w kolumnie nr_studni eksportu xlsx zewn ([de52a33](https://github.com/blodytrav3l3r/Oferty_PV/commit/de52a33f61690b976142d28e188e0758d292186f))
- **studnie:** export XLSX — well.config zamiast well.components ([6bfd7c0](https://github.com/blodytrav3l3r/Oferty_PV/commit/6bfd7c0d9a41e7a43e6cec9f0ddbeb2a0a518745))
- **studnie:** obsluga pustych zakladek DN w Excelu + skrocone etykiety uszczelek ([7c85cbf](https://github.com/blodytrav3l3r/Oferty_PV/commit/7c85cbfb683c4f179d5ec2a7442d643a3ac51713))
- **studnie:** przycisk Przelicz zamiast oninput dla ceny PEHD ([5e5ef2e](https://github.com/blodytrav3l3r/Oferty_PV/commit/5e5ef2e3eaa86b490b3d6e4a5fa7e1bf972d7790))
- **ui:** dodanie brakującej biblioteki SheetJS w kartoteka.html ([d6974c1](https://github.com/blodytrav3l3r/Oferty_PV/commit/d6974c1c86d287ea1dc3711afd2d808dc50d53c3))
- **ui:** naprawa kodowania polskich znaków we wszystkich HTML/CSS ([4428368](https://github.com/blodytrav3l3r/Oferty_PV/commit/4428368475f5dc1c895779ecb14d3ecd6df1974a))

## [1.4.0] — 2026-07-05

### Features

- **offers:** dodanie import/eksport ofert w kartotece (XLSX zewn. + JSON 1:1) ([plan](#))
    - Nowy toolbar w sekcji kartoteki z 4 przyciskami
    - Import XLSX z kolumnami: NUMER_OFERTY, INDEKS_CZESCI, ILOSC, CENA_JEDNOSTKOWA, RABAT i inne
    - Eksport XLSX do zewnętrznego systemu (ten sam format)
    - Eksport/Import JSON 1:1 z przenoszeniem oferty + zamówień między urządzeniami
    - Feature flag w tabeli settings (`feature_import_export_enabled`)
    - Obsługa konfliktów: Pomiń / Nadpisz / Utwórz kopię
    - Dennica: RABAT pusty, cena już po rabacie
    - Audit logging wszystkich akcji importu/eksportu
    - Dokumentacja usunięcia: `docs/import-export/REMOVAL-GUIDE.md`

## [1.3.0](https://github.com/blodytrav3l3r/Oferty_PV/compare/v1.2.0...v1.3.0) (2026-07-05)

### Features

- **studnie:** rozbicie wkładki PRECO na wszystkie elementy w zakładce Oferta ([69bfb53](https://github.com/blodytrav3l3r/Oferty_PV/commit/69bfb53d716b00937a89a3b3bf0d62074b5ee9a4))

### Bug Fixes

- **studnie:** przeniesienie nawigacji na koniec main ([195b5df](https://github.com/blodytrav3l3r/Oferty_PV/commit/195b5df2d03042088363c9037bb13a301b940984))

## [1.2.0](https://github.com/blodytrav3l3r/Oferty_PV/compare/v1.1.0...v1.2.0) (2026-07-05)

### Features

- **audit:** AI Learning System - full audit, fixes P1-P3, CI repair, 1299 tests ([41fe769](https://github.com/blodytrav3l3r/Oferty_PV/commit/41fe769f5c050c23e1cd42f39df29ff3a0d74f25))
- **studnie:** health check python backendu z animacja statusu ([0a8b0fa](https://github.com/blodytrav3l3r/Oferty_PV/commit/0a8b0fa05c0ea47bc55af1870de2094ef6e335c5))

### Bug Fixes

- **release:** aktualizacja regex changelog w check-version.mjs ([20cc300](https://github.com/blodytrav3l3r/Oferty_PV/commit/20cc300591f4cf17fe5b9b4f5d07fdaf18d2b7b3))
- **release:** usunieto auto-bump z commit-msg hook ([a0a2d66](https://github.com/blodytrav3l3r/Oferty_PV/commit/a0a2d66c6094c2ee69b80f5b4612b1b9a3832b7e))
- **studnie:** const visiblePrzejsciaTypes -> let (blokowal push) ([4f9b5db](https://github.com/blodytrav3l3r/Oferty_PV/commit/4f9b5db57999b2a0bc5367afc6a1d285677257b0))
- **ui:** unifikacja wersji w ui i race condition vite↔backend ([0631a5b](https://github.com/blodytrav3l3r/Oferty_PV/commit/0631a5bbbf6a70025fa1883bc2eac9e6a8dd0a1d))

## 1.1.0 (2026-07-04)

### Features

- add button to add transition columns in excel table ([4a29e31](https://github.com/blodytrav3l3r/Oferty_PV/commit/4a29e31e892635c98eac679a5e30f63a72c44183))
- add minus button to remove transition column ([51bdaaa](https://github.com/blodytrav3l3r/Oferty_PV/commit/51bdaaada7c153fcc2ebe8c79efe42d0aed3824f))
- AI Dashboard w glownym toolbarze SPA (admin/pro) ([80b5893](https://github.com/blodytrav3l3r/Oferty_PV/commit/80b5893836d0670b90d3a36104a11040f1659da4))
- **ai:** Learning Engine + Knowledge Base + Cron + Audit ([38463f1](https://github.com/blodytrav3l3r/Oferty_PV/commit/38463f108d7e05f2558457ed696c905d759dc738))
- color all tab headers with DN colors ([c5110e0](https://github.com/blodytrav3l3r/Oferty_PV/commit/c5110e07f94fb03315a38ebb8f12a325258b983a))
- color duplicate rows with DN color instead of red ([27e4466](https://github.com/blodytrav3l3r/Oferty_PV/commit/27e44660d38bd1eeed37dca23c813c98924a4ff7))
- **config:** add auto-bump version from conventional commits ([e1f8ee8](https://github.com/blodytrav3l3r/Oferty_PV/commit/e1f8ee8de0ba095e8edc82169ce461ca4c05b746))
- cross-diameter duplicate detection with colored badges ([50455d2](https://github.com/blodytrav3l3r/Oferty_PV/commit/50455d239de8f267b9dd733091f7806b680d96ae))
- excel table arrow navigation with auto-create ([09443da](https://github.com/blodytrav3l3r/Oferty_PV/commit/09443da6ce7eaed11ce86373e9c79358a3cd1376))
- **excel:** paste z Excela dokleja nowe wiersze gdy dane przekraczaja tabele ([ab91298](https://github.com/blodytrav3l3r/Oferty_PV/commit/ab9129899b409cda73173f72fbf9ed4f421450bf))
- **excel:** redukcja - elementy nadbudowy w tabeli ([ef6ffd2](https://github.com/blodytrav3l3r/Oferty_PV/commit/ef6ffd2b9f5149598d48d68b15a1664d9f734a5a))
- **graphify:** install graphify 0.9.5 skill + AGENTS.md for project-scoped knowledge graph ([137669c](https://github.com/blodytrav3l3r/Oferty_PV/commit/137669cbdb52607ab57e69549f683da2dc26a2f3))
- highlight duplicate well names in red in excel table ([55535ff](https://github.com/blodytrav3l3r/Oferty_PV/commit/55535ff9ce69a8c94a81bdea530f43858e9a99ce))
- improve excel popup ux ([315d983](https://github.com/blodytrav3l3r/Oferty_PV/commit/315d983f338152c16db5625c33cf269db1d3755e))
- inline parameter popup for each well in excel ([f132765](https://github.com/blodytrav3l3r/Oferty_PV/commit/f132765c02275d6ece64d0ed5d92ae13adc6b9d2))
- match popup rules to main configurator step3 ([bb4c944](https://github.com/blodytrav3l3r/Oferty_PV/commit/bb4c944d582e4b431960427046e0263946aedd42))
- move AI Dashboard button to top navigation bar ([2039ab6](https://github.com/blodytrav3l3r/Oferty_PV/commit/2039ab6f01cf4543ae02251102d55a117604d174))
- przenies wersje z stopki iframe do toolbara obok Wyloguj ([7ec96fb](https://github.com/blodytrav3l3r/Oferty_PV/commit/7ec96fb0db4ac5dd107e925de77140f1b9e7e317))
- **skills-v2:** Context Planner 6-stage pipeline - capabilities, utility score, typed deps, computed cost, classifier SO ([dbd856f](https://github.com/blodytrav3l3r/Oferty_PV/commit/dbd856fa826b90e15a05e9d68604e2009aa99988))
- **skills-v3:** provider pattern + feedback loop + utility recalc + 4 CLI cmds ([6e90d30](https://github.com/blodytrav3l3r/Oferty_PV/commit/6e90d301e4424b180ba581a790364502f608c6fb))
- **skills:** add js-yaml devDep + 5 npm run skills: scripts ([a4aacb8](https://github.com/blodytrav3l3r/Oferty_PV/commit/a4aacb85994e0ed58b8bcb96490ed6b5c6dd7f6f))
- **skills:** manifest-as-SSoT architecture with router, conventions-lite (3.9 KB) and skill-cli (validate/stats/cost/deps) ([e8097ce](https://github.com/blodytrav3l3r/Oferty_PV/commit/e8097ced9a66a3c435036182b9ebea7fe7a8a83e))
- skrypt budujacy offline bundle (dist-bundle/ + WITROS-Oferty-PV-Offline.zip) ([a8c7dbe](https://github.com/blodytrav3l3r/Oferty_PV/commit/a8c7dbef2557adcefeaece72a90fab58fa7699c2))
- skrypty instalacyjne i startowe (install/start dla Windows i bash) ([7abdc13](https://github.com/blodytrav3l3r/Oferty_PV/commit/7abdc132e3ee330f30db9434e0ea8feceb70d1a3))
- **studnie:** add arrow key navigation in Excel table ([20f37ed](https://github.com/blodytrav3l3r/Oferty_PV/commit/20f37ed86f7ba4a57e03f2ea4cb5e6cfdb925729))
- **studnie:** add empty row at bottom for direct well entry ([0b59a2d](https://github.com/blodytrav3l3r/Oferty_PV/commit/0b59a2d2fb36101d1f070264a163331fa82e7263)), closes [#0a0c10](https://github.com/blodytrav3l3r/Oferty_PV/issues/0a0c10)
- **studnie:** add Excel table modal for bulk well configuration ([a3e882b](https://github.com/blodytrav3l3r/Oferty_PV/commit/a3e882b0dfc5d0e60aab9747a34cd736593bdcfe))
- **studnie:** Excel modal next to diagram panel, no duplicated preview ([74bd03a](https://github.com/blodytrav3l3r/Oferty_PV/commit/74bd03ab70f2dfbbd3e18063406c6416b65fa486))
- **studnie:** responsive 3-column grid — clamp() + minmax(0,1fr) ([8c30aff](https://github.com/blodytrav3l3r/Oferty_PV/commit/8c30aff8e7f8bfd75c5b627a72b6da7407720837))
- **studnie:** rewrite Excel table — all DN tabs visible, add well per tab, Excel-like styling ([0e9a740](https://github.com/blodytrav3l3r/Oferty_PV/commit/0e9a7409fa2bf2be25f32237acc13eb976bc37a4)), closes [#0e1017](https://github.com/blodytrav3l3r/Oferty_PV/issues/0e1017) [#11131](https://github.com/blodytrav3l3r/Oferty_PV/issues/11131)
- **studnie:** show all component types in Excel table ([455daab](https://github.com/blodytrav3l3r/Oferty_PV/commit/455daab29b7ed71963378c64b128cfc649f8d355))
- **telemetry:** kompletny system AI Learning Engine + Knowledge Base ([2cbf4b0](https://github.com/blodytrav3l3r/Oferty_PV/commit/2cbf4b0bf633be64aa19bf718142e41cf55e45e6))
- **telemetry:** pasywny system zbierania danych pod przyszle AI ([4b821b1](https://github.com/blodytrav3l3r/Oferty_PV/commit/4b821b1ea5d52a260564b6af862574fc45d4eda8))
- use tile-based param popup matching main config ([7ceb91d](https://github.com/blodytrav3l3r/Oferty_PV/commit/7ceb91d5dbbebe251565cae381d7e784ac90aeed))
- **version:** add Version Guardian agent + scripts/check-version + scripts/bump-version + post-commit hook ([b153987](https://github.com/blodytrav3l3r/Oferty_PV/commit/b1539871accdeb77e1377c92812c43d3dcec145e))
- **version:** dodaj skrypty version:check / version:patch / minor / major / set w package.json ([3f206eb](https://github.com/blodytrav3l3r/Oferty_PV/commit/3f206eb7907f6cf5a889c54202d642e7551a4575))
- wymuszenie app.html jako jedynego entry-point (redirect z modułów) ([52b0d9d](https://github.com/blodytrav3l3r/Oferty_PV/commit/52b0d9de5ea36cad5c5213b365486272a322e11e))

### Bug Fixes

- add missing dev:backend script for bat file ([51f768f](https://github.com/blodytrav3l3r/Oferty_PV/commit/51f768fdf437701b2863de82f6808ae8e2bba64a))
- add missing rules to excel - autolock, konus+pehd ([cde9f8c](https://github.com/blodytrav3l3r/Oferty_PV/commit/cde9f8c5c6eba5ec0884cf7e1ec030782a8f0e38))
- add missing section nav alias for spa iframe ([72a846b](https://github.com/blodytrav3l3r/Oferty_PV/commit/72a846b0798c85d7722cc8116b6026b29580f926))
- add onblur to name field to create well on cell change ([a346154](https://github.com/blodytrav3l3r/Oferty_PV/commit/a346154ba3c6f68956782e7a316f52a81ba8d199))
- AI Dashboard visibility for admin/pro roles ([f5e850a](https://github.com/blodytrav3l3r/Oferty_PV/commit/f5e850a2c9d2502d8357057acd7ece0ca48fa387))
- **ai:** montuj dashboard routes oraz CronService ([7c0eacb](https://github.com/blodytrav3l3r/Oferty_PV/commit/7c0eacbb335f7751ae09d405ac9df263409f65aa))
- align excel middle-item insertion with main config ([93700df](https://github.com/blodytrav3l3r/Oferty_PV/commit/93700df2bc3c631349cd998dc8f71e1aa32a755d))
- align table body with -/+ header columns ([3b3ab9a](https://github.com/blodytrav3l3r/Oferty_PV/commit/3b3ab9a7f2482196291aa450f6dfaea8975cad74))
- allow column removal when no wells exist ([1137782](https://github.com/blodytrav3l3r/Oferty_PV/commit/11377827cb58eb48d22301f4114a7e40bde855b4))
- also fix zlecenia container overflow blocking sticky ([9d88bc7](https://github.com/blodytrav3l3r/Oferty_PV/commit/9d88bc7154f223b212a45987ddbcbd971e0c3b5e))
- always visible action buttons + sticky sidebar ([cb47f06](https://github.com/blodytrav3l3r/Oferty_PV/commit/cb47f061c16c654f1888168634343ee4e434d21b))
- change const currentuser to let in studnie globals ([4b87405](https://github.com/blodytrav3l3r/Oferty_PV/commit/4b87405f117042ee60f55bdd27938305a9175fad))
- change const currentuser to let in studnie globals ([1a5aa48](https://github.com/blodytrav3l3r/Oferty_PV/commit/1a5aa48109d85687212b72f98ee9a44ece91213a))
- change const to let for reassigned variables in studnie ([0e6404c](https://github.com/blodytrav3l3r/Oferty_PV/commit/0e6404c16890ee7d8363b5323f3af33d3e5bd746))
- change remaining const to let for reassigned arrays ([35b3748](https://github.com/blodytrav3l3r/Oferty_PV/commit/35b3748b4bd933e4bb565063a035f8c66af1f4d0))
- change visiblePrzejsciaTypes const to let ([231db8b](https://github.com/blodytrav3l3r/Oferty_PV/commit/231db8b7c74238062d7369031957636b71af5423))
- completely remove tab duplicate badges ([842da57](https://github.com/blodytrav3l3r/Oferty_PV/commit/842da57473082fbb8a648a39025d09eab54789b9))
- compute dupNames locally in \_excelRenderTabs ([07f3148](https://github.com/blodytrav3l3r/Oferty_PV/commit/07f3148efeba0bbe020f6c2b0705cc9f8759cce3))
- **config:** add .mjs block, clean skill-cli ([8acaaae](https://github.com/blodytrav3l3r/Oferty_PV/commit/8acaaaeecee5828e49a46afd57531266e14e6da4))
- const isBackendOnline to let (pre-existing TS2588) ([3465857](https://github.com/blodytrav3l3r/Oferty_PV/commit/34658570d3bae851c5a66ddb052eb4cd650fb2d0))
- **css:** add missing --shadow variable to :root ([c051ef7](https://github.com/blodytrav3l3r/Oferty_PV/commit/c051ef7707ad919f847b85a9b37bbd3007ce647b))
- **css:** define .nav-btn base class for media query override ([7f8e096](https://github.com/blodytrav3l3r/Oferty_PV/commit/7f8e096cd85fceefb39dbfa46144dd0f9eee26ca))
- **css:** replace undefined --bg/--text with --bg-input/--text-primary ([f104292](https://github.com/blodytrav3l3r/Oferty_PV/commit/f1042928354c0f9f9a2feba17c6c24b7e3329cbe))
- **css:** resolve .action-btn conflict with style.css base ([e55f5f0](https://github.com/blodytrav3l3r/Oferty_PV/commit/e55f5f0b19c0c464dc0dace6fa046d1e2c36221d))
- **docker:** node 20→22, regenerowany package-lock ([79ec293](https://github.com/blodytrav3l3r/Oferty_PV/commit/79ec293893e88bfaace7e21d402299919c5c7e0d))
- **docker:** npm install zamiast npm ci (odporniejsze na cache buildera) ([0cb6170](https://github.com/blodytrav3l3r/Oferty_PV/commit/0cb6170a2e807250f6aab728a8df2b003da51a59))
- dont scroll/select new well row after creation from excel ([d338e29](https://github.com/blodytrav3l3r/Oferty_PV/commit/d338e2958c74c829c610f241f8adeadfb1b574e9))
- empty string in przejscia blocked column removal ([718776f](https://github.com/blodytrav3l3r/Oferty_PV/commit/718776fe86538e6fe82365939b42dc35cdf15e73))
- evaluate isActive in template literal for onmouseenter ([763b3e8](https://github.com/blodytrav3l3r/Oferty_PV/commit/763b3e8fb06485fb428579269cb899edb988c502))
- evaluate isDup isActive in template literal for onmouseenter ([b662142](https://github.com/blodytrav3l3r/Oferty_PV/commit/b6621429b160b1e6292e7ccf369e84943e50dd71))
- excel inserts components at correct position ([cb09962](https://github.com/blodytrav3l3r/Oferty_PV/commit/cb09962c1e98046c801d05cd6d00e88731d294c2))
- **excel:** \_excelUpdateHeaderProdCodes - target z well ([0453558](https://github.com/blodytrav3l3r/Oferty_PV/commit/04535584c0a90779221dcfd686de111f03e295c2))
- **excel:** \_excelUpdateHeaderProdCodes nie filtruje main kolumn ([a16851c](https://github.com/blodytrav3l3r/Oferty_PV/commit/a16851cdd9a5734d0499457960a94a8cc7414f99))
- **excel:** auto-dodawanie włazu dla wszystkich DN ([5c5daba](https://github.com/blodytrav3l3r/Oferty_PV/commit/5c5dabaaaf39e409b9e3e11399a251671a8c466f))
- **excel:** auto-konwersja krag↔krag_ot sumuje qty z istniejącym ([7967c9d](https://github.com/blodytrav3l3r/Oferty_PV/commit/7967c9dd6394bb67468287ca4b637161ccc8dc52))
- **excel:** auto-konwersja krag↔krag_ot wg przejść ([ffd5fd0](https://github.com/blodytrav3l3r/Oferty_PV/commit/ffd5fd0e9d26201dfa957852ff8e7428423cc469))
- **excel:** data-reddn dla kolumn redukcji w h3 ([11dab64](https://github.com/blodytrav3l3r/Oferty_PV/commit/11dab643d58e22afe59fad2238e7fb18b0640181))
- **excel:** dodanie redukcji dla zakladki Styczne ([ac756e8](https://github.com/blodytrav3l3r/Oferty_PV/commit/ac756e852fb4d31f562749ffe52d6f6f35fff7fa))
- **excel:** dynamiczna zmiana etykiet nadbudowy redukcji ([f174322](https://github.com/blodytrav3l3r/Oferty_PV/commit/f174322088c969e098637b79096db45769c0e304))
- **excel:** eliminacja duplikacji kolumn redukcji ([8e30711](https://github.com/blodytrav3l3r/Oferty_PV/commit/8e307110a758e85c87331f767e9c9260cdaf2151))
- **excel:** excelOnCompChange uzywa redDn dla kolumn redukcji ([9fc4a39](https://github.com/blodytrav3l3r/Oferty_PV/commit/9fc4a3960bca843c36232041a5d9ec4b3a802094))
- **excel:** filtrowanie produktow po DN dla kolumn redukcji ([0c1979c](https://github.com/blodytrav3l3r/Oferty_PV/commit/0c1979cd92881e56130a3199183524704f6301fe))
- **excel:** getHasReduction wyklucza DN1000 ([1b349bf](https://github.com/blodytrav3l3r/Oferty_PV/commit/1b349bfdbfd5808fab16be7390b431dc380af67d))
- **excel:** jedna para kolumn nadbudowy z dynamiczna zmiana ([8b20a48](https://github.com/blodytrav3l3r/Oferty_PV/commit/8b20a4811ae5ba7fe5feeb4c6d5d11c7abab30ad))
- **excel:** kolumny nadbudowy redukcji zawsze dla DN>=1200 ([08a1ca9](https://github.com/blodytrav3l3r/Oferty_PV/commit/08a1ca97f806150df912f6d89f50b1f9f9398852))
- **excel:** kolumny nadbudowy zmieniaja sie dynamicznie ([3f9241f](https://github.com/blodytrav3l3r/Oferty_PV/commit/3f9241fccd86ada0846add711ddda1cce14d61a5))
- **excel:** kolumny redukcji pokazuja target DN w h3 ([ae7fe5e](https://github.com/blodytrav3l3r/Oferty_PV/commit/ae7fe5e9b4dcdcff4b3d8e1c1f854167309a24ff))
- **excel:** kompleksowa naprawa modulu Excel Table Manager dla wszystkich DN ([59d1e10](https://github.com/blodytrav3l3r/Oferty_PV/commit/59d1e1044ac05fe978350236daaee664ae6bdc68))
- **excel:** krag/krag_ot expandowany na osobne pozycje w configu ([25583d3](https://github.com/blodytrav3l3r/Oferty_PV/commit/25583d3054a33f4b43db7f6141937750eb7d38d6))
- **excel:** main kolumny - preferuj produkty dla DN studni ([524347a](https://github.com/blodytrav3l3r/Oferty_PV/commit/524347abe3be9d1a5f76ff057df489442f011f31))
- **excel:** nadbudowa redukcji tylko gdy studnia ma redukcje ([590b2d2](https://github.com/blodytrav3l3r/Oferty_PV/commit/590b2d2d104fddab039d4b2735544fb4ea917d68))
- **excel:** naprawa struktury kolumny Redukcja w pustym wierszu ([2424d75](https://github.com/blodytrav3l3r/Oferty_PV/commit/2424d75def1bfdbf0b29ce5c706aac129b5e2db5))
- **excel:** Nr Studni sticky + solid bg ([937f75e](https://github.com/blodytrav3l3r/Oferty_PV/commit/937f75efc94179454ef973a9132f819bbbf0f599)), closes [#13151](https://github.com/blodytrav3l3r/Oferty_PV/issues/13151)
- **excel:** oninput zamiast onchange dla komórek ilości ([ae6fc49](https://github.com/blodytrav3l3r/Oferty_PV/commit/ae6fc491b53d9acb2dafd22253d1526161da8908))
- **excel:** parowanie pł.odc↔pierśc.odc z tą samą wysokością ([4a168c0](https://github.com/blodytrav3l3r/Oferty_PV/commit/4a168c0e38837488d14b3b7274bcc3ee180d0b23))
- **excel:** paste z zewn. Excela - capture listener, startWIdx, dedup cleanup ([ad9a55e](https://github.com/blodytrav3l3r/Oferty_PV/commit/ad9a55e083e50a0f816c6a1459cb87fc1cd07ed1))
- **excel:** pelna zgodnosc nadbudowy redukcji z glownym systemem ([2a4659f](https://github.com/blodytrav3l3r/Oferty_PV/commit/2a4659f963be4f5b09229e4aaea7e6b62f3fcdf4))
- **excel:** pełna obsługa redukcji w Excel Table Manager ([b55b203](https://github.com/blodytrav3l3r/Oferty_PV/commit/b55b2034fafcb9949ca5d062a4f6c8cb9b2d9016))
- **excel:** poprawki etykiet kolumn ([ad68e7b](https://github.com/blodytrav3l3r/Oferty_PV/commit/ad68e7b7c1889f5651ada5ddf1fb39182d8328bd))
- **excel:** poprawki filtrowania DN w kolumnach redukcji ([417eabe](https://github.com/blodytrav3l3r/Oferty_PV/commit/417eabe7a5466df1d0d166206d6db0f7b3c95044))
- **excel:** poprawki tabel dla wszystkich srednic ([5f9b789](https://github.com/blodytrav3l3r/Oferty_PV/commit/5f9b789e90f5cbbee2b053879eba168d36c18324))
- **excel:** poprawna detekcja zmiany target redukcji ([e622171](https://github.com/blodytrav3l3r/Oferty_PV/commit/e6221718f706ef6633f4819eaf28094372dad0c5))
- **excel:** poprawny znak Unicode strzalki w matchesTargetDn ([40dfac8](https://github.com/blodytrav3l3r/Oferty_PV/commit/40dfac89da26cc4e90bdc84c8bfa1ce987030896))
- **excel:** R.Plyty redukcyjne - count bez filtra DN ([b4e218f](https://github.com/blodytrav3l3r/Oferty_PV/commit/b4e218f51694ed5681a0b726008ad7aff980bd07))
- **excel:** redukcja - autoSelectComponents przy zmianie w Excelu ([4ce3b10](https://github.com/blodytrav3l3r/Oferty_PV/commit/4ce3b10db6ddee6ea134eb6504514cabd2e551b5))
- **excel:** redukcja - zgodnosc z glownym systemem ([50480c0](https://github.com/blodytrav3l3r/Oferty_PV/commit/50480c0756d4cdfb6afd232a018c8aaa974463d3))
- **excel:** uproszczenie redukcji - jedna kolumna z selectem ([5c93c20](https://github.com/blodytrav3l3r/Oferty_PV/commit/5c93c204243c1b9bdcfe570757dd870d5b30c43f))
- **excel:** usuniecie duplikacji uniwersalnych produktow w redukcji ([5668d6f](https://github.com/blodytrav3l3r/Oferty_PV/commit/5668d6f268ebfd46f87b76f6681285c6092e3051))
- **excel:** usunieta przezroczystosc - solidne tla ([8b1384b](https://github.com/blodytrav3l3r/Oferty_PV/commit/8b1384b4d348ad5477f3e9adfde24126d572f8ed)), closes [#13151](https://github.com/blodytrav3l3r/Oferty_PV/issues/13151) [#13151](https://github.com/blodytrav3l3r/Oferty_PV/issues/13151) [#13151](https://github.com/blodytrav3l3r/Oferty_PV/issues/13151) [#13151](https://github.com/blodytrav3l3r/Oferty_PV/issues/13151) [#13151](https://github.com/blodytrav3l3r/Oferty_PV/issues/13151)
- **excel:** usuniete kody produktow w komorkach (cellCode) ([7e165eb](https://github.com/blodytrav3l3r/Oferty_PV/commit/7e165ebd439638417573d8d65c557bc1c5b0f4c8))
- **excel:** usuniete ostatnie transparent w button hover ([b3024e3](https://github.com/blodytrav3l3r/Oferty_PV/commit/b3024e30359b1f3f6cdf6e66bb9d8c3ca4f47515))
- **excel:** wszystkie inputy redukcji zawsze aktywne ([801a020](https://github.com/blodytrav3l3r/Oferty_PV/commit/801a0203adf539fd23eec53c6ef5c65f5deb556a))
- **excel:** wymuś właz na indeks 0, dodaj auto-parowanie pł.odc↔pierśc.odc ([7bf88d0](https://github.com/blodytrav3l3r/Oferty_PV/commit/7bf88d0d077200242aecbb3b6848e0358ecbe981))
- focus to new wells rz wlazu field after creation ([1b02698](https://github.com/blodytrav3l3r/Oferty_PV/commit/1b026984cb73cd2aacdeaf1024f65999bbe300e5))
- handle relief ring/plate pair in excel ([1bb4b8a](https://github.com/blodytrav3l3r/Oferty_PV/commit/1bb4b8a55e30df30bf9fda70a7d4475e710d1c2e))
- insert top closures after wlaz, not at position 0 ([a013a7b](https://github.com/blodytrav3l3r/Oferty_PV/commit/a013a7bfd9ff0dc81363337c49cffb38f0d38135))
- only create well from name field enter key ([c234583](https://github.com/blodytrav3l3r/Oferty_PV/commit/c234583fa66aad4db2aa99e49294f3d87383ea22))
- opaque sticky column for well names ([adaf676](https://github.com/blodytrav3l3r/Oferty_PV/commit/adaf676123f55d142edb7a50daf5c3561d031e7a))
- pin left panels with position sticky ([817e02e](https://github.com/blodytrav3l3r/Oferty_PV/commit/817e02e1ccc5c3ee4205e51f7580bc48eb6aba0b))
- pin left panels with position sticky ([a1bbc30](https://github.com/blodytrav3l3r/Oferty_PV/commit/a1bbc3065f1a443cd06aae41fe64966a4abe7a55))
- plyta_redukcyjna order 4->2.5 w sortWellConfigByOrder ([92327f6](https://github.com/blodytrav3l3r/Oferty_PV/commit/92327f63ee27e668b3a2775b71515a2335a21ba5))
- prevent tiles from wrapping in popup grid ([2fc0fe9](https://github.com/blodytrav3l3r/Oferty_PV/commit/2fc0fe90e3a260314e52dc384701dc1647d285e7))
- remove empty title containers from left panels ([f1bbbcc](https://github.com/blodytrav3l3r/Oferty_PV/commit/f1bbbccbe91a664c33dfcd5693fc8171a067b888))
- remove focus after creating well from excel empty row ([cd70d41](https://github.com/blodytrav3l3r/Oferty_PV/commit/cd70d416627c193cfa79ac614ddcc0c3adb4c8d7))
- remove main padding-bottom when builder section active to prevent body scroll ([f8a6a82](https://github.com/blodytrav3l3r/Oferty_PV/commit/f8a6a8273409c2a08b72f9124900f3976874a264))
- remove Podgląd studni title from left panel ([d93739e](https://github.com/blodytrav3l3r/Oferty_PV/commit/d93739e9d576025689e8abc6b4dd143e17a94fee))
- remove relatedTarget guard from excelCreateFromEmpty ([a4a994a](https://github.com/blodytrav3l3r/Oferty_PV/commit/a4a994ae31b2b6aa9c9bf4ab63cd526acca02cb3))
- remove remaining Podgląd studni title from h3 tag ([8928d0d](https://github.com/blodytrav3l3r/Oferty_PV/commit/8928d0da3ffd4d9face93fc3d321292f262a5339))
- reorder AI Dashboard button before Cennik in nav bar ([c4372be](https://github.com/blodytrav3l3r/Oferty_PV/commit/c4372bec28a5a7f18c8032d0490a2b54df1cb496))
- restore empty row name focus after well creation ([8b497a4](https://github.com/blodytrav3l3r/Oferty_PV/commit/8b497a46ec4e0f096506ee843bcf9a54ffcee564))
- security fixes - sql injection, xss, validation, rate limiting ([0616e29](https://github.com/blodytrav3l3r/Oferty_PV/commit/0616e299bd2fd4085268ed702b1863aa6839c202))
- set well-app-layout height + box-sizing for stable grid without scroll ([d0d5ad6](https://github.com/blodytrav3l3r/Oferty_PV/commit/d0d5ad607e73947d13ff12c4bee5b1bc0f9431e1))
- set zlecenia-container height + box-sizing, fix zlecenia-center overflow-y:auto ([13bba3f](https://github.com/blodytrav3l3r/Oferty_PV/commit/13bba3fd7bac6b10bda1d544cc27119456a80ee9))
- **studnie:** body margin zero w app.html + cache-bust css ([2b906bf](https://github.com/blodytrav3l3r/Oferty_PV/commit/2b906bf8b1fadd259a1fa7b4d8e6bce430717307))
- **studnie:** column mismatch in Excel table — Właz rendered twice in header ([bd4c5a3](https://github.com/blodytrav3l3r/Oferty_PV/commit/bd4c5a33d4ee7dfdf50d7ed96bd6543b1b04f969))
- **studnie:** double well creation in Excel empty row ([283f166](https://github.com/blodytrav3l3r/Oferty_PV/commit/283f166095a22220ea9ce2c1be22d77041e1b8e7))
- **studnie:** Excel table cell fill, reduction cols, Tab/Arrow, outline ([d85fe01](https://github.com/blodytrav3l3r/Oferty_PV/commit/d85fe01bff1c0fb57fd0d3827d9540e5762e388e))
- **studnie:** flex chain layout — sidebars touch bottom nav ([5701886](https://github.com/blodytrav3l3r/Oferty_PV/commit/570188673c3d276a8b5c287c179e3abc7192ebd6))
- **studnie:** flush panels + full-width bottom nav ([2ff0403](https://github.com/blodytrav3l3r/Oferty_PV/commit/2ff04032fca1794608b3dc0888cff60a882500c9))
- **studnie:** force full-bleed with !important, bump CSS version ([1e50ba6](https://github.com/blodytrav3l3r/Oferty_PV/commit/1e50ba654ecb4905d9cae65281253581fe0ba803))
- **studnie:** format bottom bar prices with 2 decimal places ([2d918df](https://github.com/blodytrav3l3r/Oferty_PV/commit/2d918df23bdb1c2701773b347287423dd051a815))
- **studnie:** format prices with 2 decimal places in offer summary ([d7671e7](https://github.com/blodytrav3l3r/Oferty_PV/commit/d7671e7c0dcec7ca036673d70dfd4ca571264e42))
- **studnie:** full-bleed — zeruj padding horizontal .main ([d280beb](https://github.com/blodytrav3l3r/Oferty_PV/commit/d280beb88401a83f3cabbfaa88812298f82debe1))
- **studnie:** full-bleed layout — width:100% + max-width:none on parents ([9fffc12](https://github.com/blodytrav3l3r/Oferty_PV/commit/9fffc1237cb5ffdd4d60ee51c3dbdf15ee6af46a))
- **studnie:** full-height flex chain + grid-template-rows: 1fr ([58f6967](https://github.com/blodytrav3l3r/Oferty_PV/commit/58f696787d01414086a12f53561b15bff4eafd8e))
- **studnie:** hide all scrollbars while keeping scroll functionality ([0fb5929](https://github.com/blodytrav3l3r/Oferty_PV/commit/0fb59297a1d5855daedfd854fd68b162e55e27d8))
- **studnie:** highlight entire row on cell focus via :focus-within ([c50f7a4](https://github.com/blodytrav3l3r/Oferty_PV/commit/c50f7a44fa59f41e24a7a011c41637195fb41a04))
- **studnie:** inputs fill entire cell in Excel table ([815a333](https://github.com/blodytrav3l3r/Oferty_PV/commit/815a333df6b94d6d9d004ffb6f7a8ac2892ccd4b))
- **studnie:** preserve user-entered name when creating well from Excel ([4fd960c](https://github.com/blodytrav3l3r/Oferty_PV/commit/4fd960c7a86a90aa9fe425322cfa9884d8d78fe1))
- **studnie:** remove automatic W+ prefix and cleanup DB ([fcf1fc6](https://github.com/blodytrav3l3r/Oferty_PV/commit/fcf1fc67a60fd801d36b6635dfba02d46c2018e0))
- **studnie:** remove center column scrollbar, page scrolls naturally ([3d9488a](https://github.com/blodytrav3l3r/Oferty_PV/commit/3d9488a4643e6eee180ff910336821e94fb2f5b1))
- **studnie:** remove number spinners in Excel table inputs ([79abd96](https://github.com/blodytrav3l3r/Oferty_PV/commit/79abd96a6dee6f889b2a9451638bb09459550b78))
- **studnie:** remove sidebar wells list scrollbar ([d66a4de](https://github.com/blodytrav3l3r/Oferty_PV/commit/d66a4de780dac3cb0eab0101d15f0de6bef5e223))
- **studnie:** robust empty row creation for Excel table ([bf1633b](https://github.com/blodytrav3l3r/Oferty_PV/commit/bf1633bf4bd22f7213c117ad047dfb793dd82fe4))
- **types:** naprawa 16 bledow TS w excelTableManager.js ([0ec8a7b](https://github.com/blodytrav3l3r/Oferty_PV/commit/0ec8a7bbf76bf1992d07e2c871ef96381a429fa8))
- **types:** networkidle0 as any dla puppeteer na node22 ([0206f1a](https://github.com/blodytrav3l3r/Oferty_PV/commit/0206f1a18fda839c8f572593c3811510a92f7e68))
- use \_excelCreatePrzejscie for new transition columns ([4a2cdd7](https://github.com/blodytrav3l3r/Oferty_PV/commit/4a2cdd7aee901d44d990940708cae0bcc875f772))
- usun stopke #app-footer z iframe (v2.0.0 przeniesiony do toolbara) ([0b213e6](https://github.com/blodytrav3l3r/Oferty_PV/commit/0b213e69db92b86c80f9dd655b641e6ac921584d))
- well name input background inherit ([bc436d6](https://github.com/blodytrav3l3r/Oferty_PV/commit/bc436d6743b44712e5cc63673ed75bda450184d6))

## [1.0.0] — 2026-07-04

### Changed

- **Reset numeracji** — nowy start wersjonowania od 1.0.0. Poprzednie wydanie 2.0.0 zachowane w historii poniżej.

---

## [2.0.0] — 2026-06-30

### Added

- **Excel Table** — interaktywna tabela Excel z trybem Auto/Manual, dwukierunkową synchronizacją z konfiguratorem, pollingiem 200 ms, per-wiersz przełączaniem Auto/Manual oraz przyciskiem Run Auto.
- **Auto/Manual** — system automatycznego i ręcznego sterowania konfiguracją studni; każda ręczna zmiana przestawia wiersz w tryb MANUAL, przełączenie na Auto przywraca synchronizację z solverem.
- **Eksport PDF/DOCX** — pełny eksport ofert (studnie + rury) do formatów PDF (przez Puppeteer) i DOCX (przez docx.js) z kartą budowy i zamówieniem.
- **Prisma ORM** — migracja z raw SQL na Prisma ORM (SQLite) z automatycznymi migracjami, seedem, generacją typów i integracją z TypeScript.
- **System autoryzacji** — sesje oparte na cookie + bcrypt, role użytkowników (admin/user), ochrona endpointów middleware.
- **Cenniki** — zarządzanie cenami produktów (rury, studnie) z walidacją, edycją katalogów i synchronizacją z ofertami.
- **Kartoteka klientów** — zapis, wczytywanie i zarządzanie danymi klientów z poziomu kreatora ofert.
- **Backend API** — Express.js z pełną dokumentacją Swagger, walidacją Zod, Sentry, helmet, compression.
- **Offline bundle** — skrypt `build_offline_bundle.py` generujący dystrybucję offline (zip) wraz ze skryptami instalacyjnymi (install.sh / install.bat, start.sh / start.bat).
- **Git Hooks** — commitlint + husky + lint-staged dla zapewnienia jakości kodu i konwencjonalnych commitów.
- **CI/CD Pipeline** — GitHub Actions z lintem, typecheck, testami (Jest), budową Docker i health check.
- **Skrypty backupu** — automatyczny backup bazy danych z instalacją cron-a na Windows.

### Changed

- **Przebudowa frontendu** — migracja z pojedynczych stron na SPA z routingiem hash (#/studnie, #/rury, #/kartoteka) i nawigacją w headerze.
- **Ujednolicenie API** — wszystkie endpointy zwracają spójny format JSON, błędy przez error handler.
- **Wersja produkcyjna** — bump do v2.0.0 jako stabilne wydanie produkcyjne.

### Fixed

- Naprawiona nieskończona rekurencja w `_excelSyncAutoManualUI`.
- Poprawiony overlap layoutu (100vh-120 zamiast 100vh-60) dla dolnego paska nawigacji.
- Usunięcie licznika z przycisków Auto/Manual w Excel UI.
- Synchronizacja autoSelect z configSource — poprawiona dwukierunkowość.

### Performance

- Polling Excel: 5s → 200 ms dla real-time sync konfiguratora z Excelem.
- CSS panels width awareness 60px (zamiast 57) — eliminacja overlapu.

### Refactor

- Reorganizacja nagłówków Excel (H1/H2/H3) dla czytelniejszego układu Auto/Manual.
- Katalog `graphify-out` z reprezentacją grafu zależności projektu.

---

## [1.0.0] — 2026-05

### Added

- Pierwsze wydanie aplikacji WITROS Oferty PV.
- Generator ofert dla studni betonowych i żelbetowych.
- Generator ofert dla rur (betonowe, żelbetowe, jajowe).
- Podstawowy kreator ofert z kalkulacją kosztów.
- Eksport PDF przez Puppeteer.
- Panel administratora i użytkownika.

---

_Pełna historia commitów dostępna w repozytorium Git._
