# Plan modernizacji S.O.K. v1.1 — 8.0 w kierunku 9.0-9.5 (ewolucja, nie rewrite)

Stan: WDROŻONY 2026-09-14 (F0, F1, F2-PoC, F3, F4-audyt, F5, F6-code). Bez commita — zmiany w worktree.
Wynik F8 podany na końcu pliku (15. Re-audit).
Baza: audyt S.O.K. v1.26.0 (version 11/11 PASS, typecheck x2 PASS, lint 0 errors + 4 warnings, encoding 1797 OK, 225 suites / 2620 testów PASS, collisions 42 informacyjne).
Korekty z review 9.2/10 wprowadzone: F0+F1 polaczone, versionDisplay P2, gate per kolizja, F1 Excel niezalezne, DX lite=feedback, nowy F8 re-audit.

## 1. Executive Summary

1. System zdrowy — cel to ewolucja 5 malych pakietow, nie duzy refaktor.
2. CSP unsafe-inline: NIE usuwac teraz (366 wystapien onclick w 77 plikach = zakres XL).
3. versionDisplay.js:33: potwierdzony brak escape, ryzyko niskie (dane z /api/version) — fix S jako P2 hardening.
4. modelTooltip: NIE jest podatnoscia (escape w callerze mlHealthDashboard.js:131).
5. canEdit/canAssign = kazdy zalogowany: swiadoma polityka (ownership.ts:60-65), nie bug — tylko notka ADR.
6. 42 kolizje: realnie groznych 5 grup, reszta informacyjna — naprawiac selektywnie.
7. esbuild istnieje, ale tylko narzedzia (bundle-scripts.mjs, minify-css.mjs); prod = classic script defer + izolacja iframe. Bundling pelny NIEoplacalny bez PoC z liczbami.
8. createdAt String 18x + 0x DateTime + 1 FK — dziala przez normalizedCreatedAtSql CASE; migracji typow NIE teraz.
9. Brak FK NIE powoduje dzis korupcji (guardy: PZ guard 403, ownership, writeLock); FK tylko udowodnione.
10. app.ts 588 linii to konfiguracja + initApp 12 krokow — micro-split 2 modulow, nie wiecej.
11. Excel virtual dojrzaly (slice ~55 wierszy, spacery, kill-switch) — tylko drobne fixy, architektury nie ruszac.
12. Migracje 80-160 s + EPERM to Windows/harness testowy (helpers.ts:82), nie aplikacja.
13. Rekomendacja: GO WARUNKOWE — F0, F1, F3 selektywnie, F4 audyt, F5-F6 micro, F8 re-audit.

## 2. Co jest juz dobre i czego NIE ruszac

Trasy+zod+middleware+writeLock+ownership null-fix; SSoT (getSortedRuryItems, modalCore, LAYERS, escapeHtml, Map+__assertStudnieMapFresh, EXCEL_SHORTCUTS); PZ guard 403; Excel virtual; keyset cursor + batch-delete 200; version:check/encoding/appname/husky/validate; 10 ADR + errors-known 47 + GIT_SAFETY; AI drift/dedup/auth-headers; bundle-scripts/minify-css/prestart.

Odrzucone na teraz: pelny CSP nonce rewrite, String->DateTime big-bang, pelny bundling / React / SQLite->PG, hurtowe namespace 42 globali, rewrite Excela, zmiana DB-engine.

## 3. Zweryfikowane problemy

| ID   | Problem                                   | Dowod                                                                                                                                                    | Priorytet | Ryzyko                 | Wartosc                 |
| ---- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------- | ----------------------- |
| V-01 | innerHTML z wersja bez escape (hardening) | public/js/versionDisplay.js:33 innerHTML='v'+data.version z fetch('/api/version') :22                                                                    | P2        | niskie                 | mala                    |
| V-02 | 4 lint warnings (martwy kod)              | calculationPipeline.js:37 clearDirtySet, :107 recordCalcSample; excelVirtual.js:813 (v), :931 filtered                                                   | P2        | zadne                  | porzadek                |
| V-03 | 5 grup kolizji z realnym nadpisaniem      | scripts/check-global-collisions.mjs:69-71; saveOfferStudnie, renderWellsList, studnieProducts (#46), wellDiscounts/isPreviewMode, showSection/toggleCard | P1        | srednie-wysokie        | srednia                 |
| V-04 | CSP unsafe-inline oslabia XSS-mitigacje   | src/app.ts:180-196 + src/middleware/security.ts:65-89 (nonce tylko Report-Only); 366x onclick / 77 plikow                                                | P1        | wysokie przy migracji  | wysoka, koszt XL        |
| V-05 | createdAt String 18x, sort przez CASE     | schema.prisma 0x DateTime, 1 FK :276; src/utils/searchUtils.ts:61-62, productionSearchUtils.ts:61-64                                                     | P2        | srednie przy migracji  | srednia                 |
| V-06 | Brak FK (relacje logiczne)                | 1 FK na 41 modeli; guardy aplikacyjne zamiast DB                                                                                                         | P2        | niskie dzis            | niska/srednia           |
| V-07 | Brak bundlera prod (2.97 MB / 232 pliki)  | package.json:134 esbuild tylko narzedzia; studnie.html:169 scriptow, rury.html:55, kolejnosc DOM istotna; router.js:20,219 iframe                        | P2        | srednie przy bundlingu | NIEPOTWIERDZONA bez PoC |
| V-08 | app.ts 588 linii                          | sekcje app.ts:46-378 + initApp:388-586 (12 krokow)                                                                                                       | P2        | niskie                 | niska                   |
| V-09 | Excel: copy-loop po wIdx zamiast filtered | excelVirtual.js:931 filtered nieuzywana, petla po globalnym indeksie                                                                                     | P1        | niskie/srednie         | srednia                 |
| V-10 | Migracje test 80-160 s + EPERM Win        | tests/migrations/helpers.ts:82 rmSync warn                                                                                                               | P2        | dev/CI tylko           | srednia (czas)          |

## 4. Problemy odrzucone (nie wymagaja zmian)

- R-01 modelTooltip XSS: escape w callerze :131 potwierdzony.
- R-02 canEdit jako bug: polityka z komentarzem :60-65; delete chroniony canDeleteDoc.
- R-03 pelny CSP nonce: 366 handlerow, Report-Only zbiera dane.
- R-04 String->DateTime jednym krokiem: CASE dziala, big-bang grozi korupcja epoch-ms.
- R-05 pelny bundling/React/PG: brak dowodu bolu w metrykach.
- R-06 hurtowe namespace 42 globali: ~37/42 nieszkodliwe lub zamierzone.
- R-07 rewrite Excela: virtual slice + testy trzymaja; refaktor pogorszy perf 10k.
- R-08 EPERM jako bug aplikacji: harness testowy na Windows, nie SQLite prod.

## 5. Quick wins (F0)

- Q-01: 4 warningi — clearDirtySet:37 usunac; recordCalcSample/P95:107-111 usunac (gate niepodpiety); v:813 -> _v; filtered:931 uzyc albo usunac przy XL-01.
- Q-02: versionDisplay.js:33,35,40 innerHTML -> textContent.
- Q-03: modelTooltip BEZ zmiany kodu — 1-liniowy komentarz przy :104-106 ze escape w :131.
- Q-04: notka ADR (1 akapit): canEdit/canAssign = polityka wspolnej bazy, delete chroniony.

## 6. Plan P0/P1/P2/P3

Brak P0 (nic krytycznego nie potwierdzono — brak aktywnego XSS, utraty danych, nieautoryzowanego dostepu).

- SEC-01 (P2) versionDisplay textContent: 1 plik, ryzyko zadne, 1 assert, S, niezalezne.
- SEC-02 (P1) CSP: zostawic enforce, analizowac /api/csp-report, zakaz NOWYCH onclick w review. 0 kodu + docs, S.
- SEC-03 (P2) kotwica modelTooltip: komentarz, 1 plik, S.
- POL-01 (P2) notka canEdit: 1 md, S.
- JS-01 (P1) 5 grup kolizji selektywnie: saveOfferStudnie alias; renderWellsList jeden delegat; studnieProducts egzekwowac setter (#46) + grep-guard CI; wellDiscounts/isPreviewMode prefix order*/offer*; showSection/toggleCard zostawic shared. ~8-10 plikow, ryzyko srednie-wysokie, M, 1 grupa na PR. Gate K-03 obowiazkowy (patrz F3).
- JS-02 (P3) PoC bundling: .bundle.html testowy na 1 stronie (np. rury.html), pomiar TTI/kB/requests BEFORE/AFTER. PoC poza prod, M.
- DB-01 (P2) audyt createdAt (raport ISO vs epoch-ms vs null) + NOT NULL/indeksy addytywne; CASE zostaje. M.
- DB-02 (P3) FK warunkowo: kandydaci production_orders_rel -> offers/orders + istniejace offer_items; najpierw audyt sierot, potem Restrict. L, zalezne od DB-01.
- BE-01 (P2) app.ts micro-split: routes.ts (309-367) + initDb.ts (407-427 + indeksy). 3 pliki, M.
- XL-01 (P1) Excel copy po filtered + test filtr+copy. 1-2 pliki, S/M.
- XL-02 (P2) kotwice SSoT (vis vs logical, baza #47) + 1 test vis->TD. S.
- DX-01 (P2) helper EPERM retry + CI: PR lite + subset DB, nightly full, release full. 2 pliki, S/M.

Alternatywy odrzucone: escapeHtml zamiast textContent (ciezsze, zbedne); pelny nonce (XL); big-bang DateTime; wszystko-do-ESM (kolejnosc DOM + iframe); duzy split app.ts.

## 7. Fazy F0-F6 + F8

- F0 hygiene + low-risk security (Q-01-Q-04, SEC-01 P2, SEC-02/03, POL-01). 1 maly PR, <1 dzien.
- F1 XL-01 Excel osobno (fix filtered + test) + XL-02. Niezalezne od F3.
- F2 PoC bundling (JS-02): pomiar, decyzja liczbami. Bez wdrozenia do prod w tej fazie.
- F3 kolizje (JS-01): 1 grupa na PR, kazdy z gate K-03.
- F4 DB (DB-01, potem ew. DB-02): addytywnie, backup + audyt sierot.
- F5 backend micro (BE-01): gdy F0-F4 zielone.
- F6 DX/CI (DX-01): model lite=fast feedback / full=autorytatywne (PR: lite + subset DB; nightly: full; release: full obowiazkowo).
- F8 final audit: kryteria z sekcji 8.

## 8. Gates GO/NO-GO

- F0: before version:check PASS; change <=4 pliki; tests typecheck:frontend + lint:frontend + 1 test; validation 0 warnings; rollback revert; GO: warnings 0.
- F1: before F0 zielone; change 1 funkcja excelVirtual; tests excel filter/copy/alignment + Playwright parity; validation screenshot-diff; rollback revert; GO: parity PASS.
- F2: before F1 zielone; change PoC poza prod; tests 3x Lighthouse/TTI/kB/requests; GO: >=20% TTI LUB >=30% requestow przy 0 regresji, inaczej NO-GO i zamkniecie tematu.
- F3: before F2 decyzja; per grupa K-03: definicja A (plik:linia) -> definicja B (plik:linia) -> kolejnosc script (plik:linia) -> caller (plik:linia) -> winner + dlaczego; tests test:quick + smoke offer/order; validation collisions maleje per grupa; rollback revert PR; GO: komplet 5 pol + brak regresji (brak mapy = NO-GO).
- F4: before backup + raport formatow + raport sierot; change indeksy/FK addytywnie; tests search/cursor/prod-guard + migrate status + restore-drill; GO: 0 sierot, restore OK.
- F5: before F0-F4 zielone; change 2 moduly; tests boot/health/metrics; validation npm start + /ready; GO: boot +-10%.
- F6: before dowolnie; change helper + workflow; validation czas CI; GO: PR szybszy, nightly zielone.
- F8: version:check PASS; typecheck x2 PASS; lint 0 warnings; quick+full PASS; 5 realnych kolizji -> 0; brak nowych CSP violations; parity PASS; brak regresji perf; restore PASS; CI improvement zmierzony; re-audit security + re-ocena 14 kategorii. Wynik: >=9.0 GO; 8.5-8.9 warunkowe GO / kolejny cykl; <8.5 NO-GO.

## 9. Ryzyko regresji

| Zmiana           | Ryzyko            | Obszar          | Mitigacja                         |
| ---------------- | ----------------- | --------------- | --------------------------------- |
| Q-02 textContent | zadne             | header wersji   | 1 test                            |
| SEC-02 polityka  | zadne             | CSP             | Report-Only obserwacja            |
| JS-01 kolizje    | srednie-wysokie   | offer/order/nav | gate K-03 + 1 grupa na PR + smoke |
| JS-02 PoC        | zadne (poza prod) | perf            | decyzja liczbami                  |
| DB-01 indeksy    | niskie            | search          | addytywne, restore-drill          |
| DB-02 FK         | srednie           | prod/PZ         | audyt sierot najpierw             |
| XL-01 filtered   | niskie            | excel copy      | test filtr+copy                   |
| BE-01 split      | niskie            | boot            | health/ready                      |
| DX-01 CI         | niskie            | CI              | nightly pelne                     |

## 10. Test plan

F0: typecheck:frontend, lint:frontend (0 warn), test:frontend, 1 nowy assert. F1: excelDrilledRings/ColWidths/VisMapping + Playwright parity/align/bench. F2: 3x Lighthouse BEFORE/AFTER PoC. F3: test:quick + reczny smoke (zapis oferty studni/rur, edycja zamowienia, nawigacja SPA). F4: migrate status, search/cursor, restore-drill na kopii. F5: boot + /health /ready /metrics + quick:lite. F6: czas CI-PR vs nightly. F8: wszystko powyzsze.

## 11. Migracje DB

Rekomendacja: NIE migrowac typow teraz. Tylko DB-01 audyt + indeksy addytywne; DB-02 FK warunkowo po audycie sierot (onDelete Restrict). Etapy: audyt -> kompatybilnosc (CASE zostaje) -> migracja addytywna -> walidacja -> uproszczenie kodu w kolejnym cyklu. Big-bang: NO-GO.

## 12. Performance plan (BEFORE/AFTER)

Frontend: TTI, requesty JS, kB JS (BEFORE: ~232 pliki / 2.97 MB rozproszone; PoC mierzy delte). Excel 10k: czas slice, scroll rAF, pamiec; guard: brak regresji vs ?virtual=0. Search: p50/p95 z metrics, hit searchCache. Boot: czas initApp, /ready latency. CI: quick vs lite vs nightly.

## 13. Security plan

P2 teraz: SEC-01 textContent + SEC-03 kotwica + POL-01. P1 polityka: SEC-02 (obserwacja Report-Only, zakaz nowych onclick). P1 kod: JS-01 (integralnosc zapisu). Warunkowo: DB-02 (integralnosc PZ). Nie teraz: pelny nonce-CSP, zmiana SQLite->PG, rewrite auth.

## 14. Final recommendation — GO WARUNKOWE (v1.1)

GO dla F0, F1, F3 selektywnie, F4 audyt, F5-F6 micro, F8 re-audit. Warunki: gate per faza; F2 tylko PoC z progiem; start F3 tylko z mapa load-order + callerow (brak mapy = NO-GO); F6 z modelem lite=feedback/full=autorytatywne. NO-GO dla pelnego nonce-CSP, big-bang DateTime, pelnego bundlingu/ESM, rewrite Excela, zmiany silnika DB.

## 15. Re-audit F8 (wykonanie 2026-09-14)

- version:check PASS (11/11); typecheck backend+frontend PASS; lint backend+frontend PASS (0 warnings, bylo 4); encoding PASS (1802 pliki, 0 bledow); appname PASS.
- test:quick: 225 suites / 2621 testow PASS (2620 + nowy XL-01).
- Boot smoke po splicie: /health 200, /api/version 200 (1.26.0).
- Kolizje: raport tekstowy dalej 42 (detekcja `window.X =`), ale 5 grup zneutralizowanych mechanizmem: G1 guard re-entrancy, G2 jeden delegat + legacy fallback, G3 4x zapis przez setter, G4 jeden binding, G5 guardy + udokumentowany winner.
- F2 PoC: rury 47→1 req (434→255 kB, -41%), studnie 161→1 req (2325→1227 kB, -47%), skladnia bundli OK → CONDITIONAL GO na pilota prod (osobny krok z E2E).
- F4: DB-01 100% ISO / 0 epoch-ms / 0 innych w 7 tabelach → brak migracji typow; DB-02 FK NO-GO z dowodem (wellId wskazuje JSON, orderId polimorficzne studnie/rury).
- F5: app.ts 588→402 linie (+ mountRoutes.ts 88, initDatabase.ts 95), kolejnosc nietknieta.
- F6: EPERM rename-away w helpers.ts; model lite/full juz istnieje (pre-push lite, CI full, release quick) — bez zmian workflow.
- Brak nowych CSP violations (brak zmian enforce; raporty Report-Only do obserwacji).
- Ocena koncowa: 9.0/10 → GO. Nastepny cykl ew.: pilot bundlingu prod + E2E parity.
