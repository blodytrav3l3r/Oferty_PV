# Plan naprawy zweryfikowany — S.O.K v1.31.0 (2026-09-27)

Weryfikacja 3 agentami (P0/P1/P2). Tylko uwagi POTWIERDZONE / CZĘŚCIOWO wchodzą do planu. Odrzucone — sekcja 4, bez działań.

## 1. Werdykty zbiorcze

| #     | Uwaga                                     | Werdykt                                 | Dowód                                                                                  |
| ----- | ----------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------- |
| P0.1  | Desync wizard `style.display` vs `hidden` | ODRZUCONE (naprawione) + dirty worktree | `offerNavigation.js:17-18` tylko `hidden` + cleaner legacy                             |
| P0.2  | Ghost-draft duplikaty                     | ODRZUCONE jako bug, CZĘŚCIOWO ryzyko    | `draftAutosave.js:486,565,654`, `offerSave.js:145-146`, `orderCrud.js:577,1268`        |
| P0.3  | N+1 krytyczne / brak indeksów             | ODRZUCONE, CZĘŚCIOWO pętle batch        | `schema.prisma:95-100`, `search.ts:103-201`, resztka `production.ts:224,253,688`       |
| P1.1a | Brak historii/rollback cenników           | CZĘŚCIOWO                               | `pricelistVersions.ts:111-243` brak clone/revert, UI `pricelistVersions.js:194-203`    |
| P1.1b | Dual-write #45                            | ODRZUCONE (naprawione)                  | `priceOverrideService.ts:263-321,542-548` kompensacja OK                               |
| P1.2  | Dark/light kontrasty                      | CZĘŚCIOWO                               | D1/D3 naprawione (`--text-muted #8a9cae`, `--accent #5b5fec`); otwarte L8/D4/D8/D10/D5 |
| P1.3a | Duplikacje nagłówka/logo                  | ODRZUCONE                               | `headerUser.js:11-27`, `style.base.css:691-737,589-604` SSoT                           |
| P1.3b | Inline style w JS                         | POTWIERDZONE resztkowo                  | `actionsConfigDrag.js:58,220`, `offerRendering.js:151,153`, `pricelistManager.js:105`  |
| P2.1  | localStorage bez guarda                   | POTWIERDZONE częściowo                  | `kartotekaInit.js:41,66`, `mlDualRanking.js:175`, `excelVirtual.js:357-358`            |
| P2.2  | A11y/align nie przechodzą                 | NIEPOTWIERDZONE statycznie              | skrypty + `:focus-visible:464` + sticky `#31` istnieją; brak w `validate`              |
| P2.3  | Docs sync errors-known↔AGENTS             | POTWIERDZONE (udokumentowane)           | `errors-known.md:3-21` DOC_GAP #50-52, `AGENTS:346`                                    |

## 2. Plan naprawy (tylko potwierdzone)

### Faza A — małe fixy (1 batch, 🟢/🟡)

1. **Dirty worktree commit** — `wizard.js` + `offerNavigation.js` (niezatwierdzona zmiana semantyki `step3Active`). Bez commita ryzyko nadpisania. Fix: review diff → commit.
2. **Inline style → klasy** — `.config-tile.is-dragging{opacity:.4}` + `classList` zamiast `style.opacity` (`actionsConfigDrag.js:58,220`); tak samo `offerRendering.js:151`, `pricelistManager.js:105`. Zgodne z bazą #5.
3. **localStorage guardy** — `try/catch` + walidacja typu w `kartotekaInit.js:41,66`, `mlDualRanking.js:175`, `excelVirtual.js:357-358` (wzorzec `displayUnits.js:70-105`, `theme.js:35-57`). Bez nowego helpera.
4. **Docs sync** — dopisać skróty #50-52 (i #53/#54) do AGENTS §5 lub rozszerzyć mapę w `errors-known.md:19-21`. Bez przenumerowania (odnośniki `#3/#24/#39` stabilne).
5. **A11y do validate** — dopiąć `test:axe` / `test:alignment` do CI lub `validate` (`package.json:29`). Testy istnieją, tylko nie wpięte.

Verify Fazy A: `node -c` dla JS, `npm run lint:frontend`, `npm run test:quick`, `npm run format`.

### Faza B — cenniki rollback (🟡 Batch GO)

6. **POST /api/pricelist-versions/:id/clone-draft** — kopia wierszy wersji → nowy DRAFT (seq auto) + przycisk w `pricelistVersions.js:185-239` ("Przywróć jako draft"). Brakuje tylko tego; historia/diff/eksport istnieją. Usuwanie draftu opcjonalnie.
   Verify: `prices:verify`, test endpointu 200/400/403.

### Faza C — batch-write N+1 resztka (🟡)

7. **`production.ts:688-693` recycle + `:224,253` save** — `findMany id IN (...)` + `createMany` zamiast `findUnique` per element (wzorzec delete `:661` już tak ma).
   Verify: `benchmark:quick`, `test:quick`.

### Faza D — dark/light resztka (🟡)

8. **L8/D4** `style.responsive.css:174-178` → `background:var(--bg-secondary); border:1px solid var(--border)` + kasacja `blur(10px)`.
9. **D8** pastele w dark root (`style.base.css:59,68,76`) → `#0d2a20/#3a1515/#2d1a08` lub audyt użyć.
10. **D10** brak `--focus-*` (`style.base.css:433-436`) → `--focus-ring:var(--accent-border)` per motyw.
11. **D5** glass resztki (`zlecenia.css:386`, `studnie.css:1738,2014`, `printModal.css:29`) → `--shadow-*`.
12. **Light graniczne** th 4,08 (`:2195`), badge-warn 4,43 (`:2246`) → `#996600→#7a5200` + re-pomiar.
    Verify: `test:axe`, screenshoty 375/768/1440, `UI_GUIDELINES.md` tokeny.

## 3. Kolejność

Faza A → commit → Faza B → Faza C → Faza D. Każda faza: GO przed kodem, push osobne GO (kontrakt autonomii 🔴).

## 4. Odrzucone (bez działań)

- P0.1 desync mechanizmu, P0.2 ghost-draft aktywny, P0.3 N+1 listowe, P1.1b dual-write, P1.3a duplikacje nagłówka, P2.2 fail A11y statycznie — dowody powyżej, mechanizmy naprawcze istnieją i są wpięte.
