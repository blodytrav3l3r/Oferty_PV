# Wydajność i pomiary

## A8 · Pomiar bieżący

FACT, test mikro lokalnego parsera. Windows, Node 24.18.0, Ryzen 9 5950X, 32 wątki logiczne, 63,91 GiB RAM. JSON aktywnych cenników, 1 232 781 B, odczyt do pamięci przed pomiarem. 30 rozgrzewek i 200 kolejnych wywołań JSON.parse, performance.now, nearest rank. p50 1.446 ms, p95 1.703 ms, max 2.700 ms. Wynik obejmuje wyłącznie parsowanie tekstu. Walidacja SHA, migracja, PostgreSQL, UI, I/O oraz instalator nie należą do metody. Brak pomiaru na sprzęcie 4 GB.

## Porównanie historyczne Excel

Artefakt docs/plans/bench-excel-virtual-1000-5000-throttle-x4.json:2–76 z 29.10.2026 zawiera po jednym rekordzie tryb/N na Windows, Ryzen 5950X i throttle x4, viewport 1600×1000.

| Wiersze |      OFF, czas / DOM |   ON, czas / DOM |
| ------- | -------------------: | ---------------: |
| 1000    |  37 143 ms / 139 516 | 1518 ms / 13 053 |
| 5000    | 168 009 ms / 679 516 | 1628 ms / 13 053 |

To wynik historyczny, z emulacją CPU, bez reprezentatywnego p95 oraz bez dowodu dla bieżącego HEAD. Rozmiary 100 i 10 000, rzeczywisty i3/i5 oraz 4 GB, heap, reflow/repaint, liczba listenerów, FPS, startup, zapisy/odczyty ofert, DB i eksporty mają N/A w tym przebiegu.

## Wąskie gardła do potwierdzenia

1. PERF-01, wniosek. Otwarcie Excel wykonuje synchronizację pełnego zbioru niezależnie od wirtualizacji widocznych wierszy. Pętle i szukanie produktów wymagają profilu CPU i scenariusza liczby konfiguracji. public/js/studnie/excelModal.js:217–323 oraz excelVirtual.js:348–368,427,447–495,643.
2. FE-08, fakt z kodu. CennikHost na ścieżce aktywacji odczekuje zaprogramowane co najmniej 250+150 ms. Nie jest to zmierzony czas nawigacji. public/js/cennik/cennik.js:188–231.
3. DB-03, wniosek. Wyrażenia dat, FTS i sortowanie wielotabelowe wymagają profilu planner/buffers dla rzeczywistego rozkładu danych. Istnieją indeksy GIN.
4. SEC-07, wniosek. Duże payloady ofert 128 MiB i kopie wells/wellsExport zwiększają koszt serializacji, parsowania i pamięci. src/mountRoutes.ts:49–57.
5. FE-03, hipoteza wykonania. Retencja iframe może utrzymywać heap, okresowe żądania i listenery. Potrzebny trace przed/po cyklu przełączeń.
6. 263 śledzone pliki JS frontendu bez ścieżek vendor/lucide to 4 411 841 B źródeł. Rozmiar źródeł nie jest wielkością transferu, ponieważ aktywa ładowane są na żądanie, kompresowane lub bundlowane.

## Metoda kolejnego przebiegu

Izolowany PostgreSQL 18, serwer na osobnym porcie, syntetyczne oferty i snapshoty, kontrolowana wersja Chromium, wynik tylko w katalogu audytu. Dla 100/1000/5000/10 000 porównać cold/warm, virtual ON/OFF, co najmniej 20 prób mierzonego scenariusza, p50/p95/max, JS heap, RSS, CPU, DOM, rAF/long tasks, zapytania, payload i ślady profilerów. Rzeczywisty profil 4 GB mierzyć osobno. Przed pomiarem zweryfikować bazę i ścieżki wyników. Obecne harnessy mogą wskazywać localhost:3000 i zapisywać docs/plans (tests/playwright/excelVirtualBench.cjs:10,37–43,132–166,214; excelOpenPerf.cjs:29–33,189–196,284).
