# Incident audit — read-only (bez restartów, buildów, killi, zmian kodu)

**Status:** ustalenia, nie naprawa. Serwer deweloperski (ts-node-dev, port 3000) nie nasłuchuje; 3 procesy node z 07:47 żyją bez listenera.
**Zakres:** 7 pytań z polecenia. Metoda wyłącznie odczytowa (konfigi, logika watchera, oś czasu).

## 1. Samozakończenie procesu drillu — NIEWYJAŚNIONE

Proces na 3178 obsłużył `/health` 200 i login 200, potem zniknął bez logów (redirect stdout do plików nie zadziałał — pliki nie powstały). Kandydaci: nieobsłużony wyjątek po zalogowaniu, OOM przy 1.3 GB DB, zewnętrzny kill. Brak dowodu — nie zgadywać. Wymóg na przyszłość: stdout+stderr do plików, exit code, health-poll z timeoutem.

## 2. Czy `npm run build` wpłynął na ts-node-dev — NIE (z dużym prawdopodobieństwem)

Watcher (`ts-node-dev --respawn`, bez flag `--watch`): obserwuje WYŁĄCZNIE pliki wymagane przez proces (plus tsconfig), `node_modules` wyłączone. `dist/*.js` i `data/*` nie są wymagane → build ani backup nie wywołują respawnu. Respawny korelują natomiast z moimi edycjami `src/*.ts` (każdy save = respawn) — zachowanie normalne, nie incydent.

## 3. PID 45408 — najpewniej mój osierocony harness, nie prod

Start 12:31, singleton (poza klastrem 07:47). Harness spawnuje `node dist/server.js` na 3177 i zabija po 3 s bez weryfikacji zgonu — przy wolnym starcie sierota zostaje. Klastry prod (3× node z 07:47) były wtedy nietknięte. Pewność: wysoka, nie absolutna (post-mortem niemożliwy po killu). Lekcja: kill TYLKO po weryfikacji portu, nie po heurystyce startu.

## 4. Dlaczego 3000 przestał nasłuchiwać — NIEWYJAŚNIONE (kandydaci)

Procesy żyją, listenera brak: supervisor przy życiu, worker martwy lub wiszący po nieudanym respawnie. Ostatnie zapisane edycje `src/*.ts` były rano (P0 clients) — serwer po nich działał. Kandydaci: (a) crash aplikacji (np. cron ML ~11:47 + OOM przy dużej DB — do weryfikacji w logach po restarcie, NIE teraz), (b) nieudany respawn (EADDRINUSE w handoverze), (c) przyczyna zewnętrzna. Ewidencja: PID churn 39532→37448 już w fazie read-only (przed moimi edycjami src) — patrz pkt 5.

## 5. Wcześniejszy churn — częściowo wyjaśniony, częściowo nie

Część churnu to normalne respawny po moich edycjach `src/*.ts`. Ale co najmniej jedna zmiana PID nastąpiła w fazie read-only (same odczyty + backupy + pliki .md/Temp — wszystko poza watchą). To sugeruje pre-istniejącą niestabilność OBRÓCONĄ moimi obserwacjami, niekoniecznie spowodowaną przeze mnie. Do potwierdzenia po restarcie (logi ts-node-dev).

## 6. Watcher vs dist/ — brak niebezpiecznej interakcji

Patrz pkt 2: `dist/` i `data/` poza watchą. Niebezpieczna jest natomiast każda edycja `src/*.ts` przy działającym dev-serwerze (respawn w locie) — to workflow projektu, nie bug. Rekomendacja: dokumentować, nie zmieniać.

## 7. Bezpieczniejsza procedura drill-app (twardy invariant, nie rekomendacja)

**Żaden proces drillowy nie startuje bez jawnie ustawionych i zweryfikowanych PRZED spawnem wartości drillowych `DATABASE_URL` i `PORT`. Brak jawnego drill ENV = natychmiastowy STOP.** Bookendy: prod health PRZED drill → drill → prod health PO (dowód, że środowisko przetrwało operację).

Drill process NIE MOŻE odziedziczyć prod env: zawsze jawny blok env (DATABASE_URL na cel, PORT ≠ 3000, sekret z .env bez wypisywania). Przed startem: asercja wolnego portu drill + potwierdzenie, że prod port trzyma stary PID. kill WYŁĄCZNIE po PID zapisanym przy starcie, z weryfikacją zgonu. Stdout/stderr do plików + exit code. Health prod PRZED i PO drillu jako bookendy. Pierwszy start z prod-env (mój błąd składni, zabity w sekundy przed requestami) nie może się powtórzyć — to P0 proceduralne.

## Werdykt

- DRILL: GO (dowód kompletny).
- INCYDENT 3000: OPEN — przyczyna nieustalona read-only; wymagany restart po stronie użytkownika + odczyt logów startu.
- Dalsze drille/uruchomienia: HOLD do wyjaśnienia.
- Winę za konkretny trigger biorę częściowo na wspólne ryzyko (kill 45408, build), ale dowody wskazują też na komponent pre-istniejący (churn w fazie read-only).
