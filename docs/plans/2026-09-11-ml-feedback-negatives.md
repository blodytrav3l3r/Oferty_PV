# §8a — plan pozyskiwania wiarygodnych negatywów (read-only, bez implementacji)

**Status:** plan do oceny. Implementacji nie rozpoczęto — nie wykonywać bez jawnego polecenia.
**Input:** `docs/plans/2026-09-11-ml-label-audit.md` (fakty) + audyt kodu ścieżki `user action → label`.
**Twarda zasada:** wiarygodne negatywy bez sztucznych REJECT-ów. Nie pompujemy liczności kosztem jakości.
**Poza zakresem:** progi 50/100/300, relabeling historycznych danych, backfill, zmiany w Learning Engine.

## 1. Ocena hipotez

### H1 — REJECTED: sygnał istnieje technicznie, nie istnieje praktycznie. Werdykt: nie poszerzać na siłę

- Jedyny nadawca: `_signalAiOverrideOrModify` (`actionsCrud.js:13`) przy `prevConfigSource === 'AUTO_AI'`. Produkcja: 0 wierszy `AI_SUGGEST`, 0 flag `wasRejected`, 0 rewardów REJECT.
- Kandydat na nowe źródło: usuwanie całej studni (`removeWell`, `actionsWellCrud.js:214`) — dziś **zero sygnału** (splice + refresh, nic do ML). Odrzucenie całej sugestii to semantycznie najsilniejszy negatyw w systemie.
- Ale: usunięcie ≠ zła sugestia (duplikat, zmiana klienta, pomyłka DN). Bez rozróżnienia powodu to właśnie byłby sztuczny REJECT. Dlatego H1 NIE kończy się decyzją „wysyłaj REJECT przy usuwaniu" — kończy się opcjami w §2.

### H2 — MODIFIED: semantyka poprawna, zostawić. Werdykt: bez zmian

- Negatywem jest wyłącznie modyfikacja _sugestii_ (łańcuch `parentConfigId`), nie dowolna edycja — 32 etykiety z 779 flag `wasModified` to nie bug, to filtr jakości.
- Waga 0.5 oddaje niepewność („sugestia nie była finalna", niekoniecznie „była błędna"). Przy 32 próbkach każda zmiana wagi/semantyki to losowość, nie nauka.
- Jedyna luka techniczna (do decyzji w §2, opcja B): `onWellModified()` wołane bez studni (`actionsCrud.js:18`) — linkage przez `getCurrentWell()` działa, ale jest kruchy przy szybkich przełączeniach studni.

### H3 — wasAiRanked: rola już właściwa. Werdykt: nie poszerzać

- Backend używa `wasAiRanked` wyłącznie do wysokości nagrody (1.0 vs 0.5) i bramki sliding-AUC (`telemetryAiMl.ts:317`), nigdy do etykiet.
- Frontend już dziś bramkuje nim REJECT (tylko AUTO_AI). Poszerzenie go na AUTO_JS zamieniłoby zwykłe poprawki solvera w „odrzucenia AI" — dokładnie ten fałszywy negatyw, przed którym chroni zasada §8a.

## 2. Opcje minimalnej zmiany (do decyzji, NIE do wykonania)

| Opcja | Treść                                                                                                                                                                                                                                                                                                                                                                                                           | Zysk                                                                | Ryzyko                                                                     |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| A     | Event (nie etykieta) przy usuwaniu studni z `_lastAutoTelemetryId`: `telemetryRecordEvent({eventType:'well_deleted'})` + przyczyna `duplicate \| bad_suggestion \| customer_change \| other \| unknown`, gdzie **`unknown` jest legalną wartością** (brak wymuszonego wyboru w UI = brak zgadywania). Usunięcie NIGDY nie jest domyślnie `bad_suggestion`. Etykietowanie dopiero po analizie rozkładu przyczyn. | Pierwszy pomiar skali gubionych negatywów, zero ryzyka dla datasetu | Prawie zerowy natychmiastowy zysk dla treningu                             |
| B     | Jawne przekazywanie studni do `onWellModified(well)` w `_signalAiOverrideOrModify` (dziś fallback na `getCurrentWell()`).                                                                                                                                                                                                                                                                                       | Pewny linkage MODIFY→sugestia, mniej gubionych 34→?                 | Minimalne; dotyka gorącej ścieżki edycji                                   |
| C     | REJECT przy usuwaniu studni AUTO (sugestia, nigdy nie zamówiona).                                                                                                                                                                                                                                                                                                                                               | Szybkie negatywy                                                    | Wysokie: sztuczne REJECT-y z duplikatów/zmian klienta; łamie twardą zasadę |

Rekomendacja autora: **A jako osobny minimalny krok telemetryczny, potem obserwacja; B jako osobny mały krok TYLKO jeśli potwierdzi się gubienie linkage** (naprawa linkowania to osobna zmiana zachowania, nie „przy okazji"); **C odrzucić (NO-GO)** — chyba że dane z A pokażą, że dominuje przyczyna „zła sugestia".

## 3. Kryteria akceptacji przyszłej implementacji (gdy będzie GO)

- **Event `well_deleted` nie zmienia `AiFeature.label`.** Granica: telemetria → obserwacja rozkładu → osobna decyzja o kwalifikacji → dopiero ewentualnie label.
- Nowa ścieżka nie zmienia istniejących etykiet (MODIFIED/ACCEPTED/NO_FEEDBACK nietknięte).
- Każdy nowy sygnał negatywny ma test: happy path + przypadek „duplikat nie jest negatywem".
- F3 pokazuje efekt (rosnący licznik, niekoniecznie trening — SUCCESS zależy też od balansu).
- Progi 50/100/300 ruszane wyłącznie na podstawie danych po zmianie, osobną decyzją.

## 4. Weryfikacja przyszłej implementacji

`typecheck` + `lint` + `lint:frontend` + `node -c` dla plików `public/js` + testy ML + `format`. Bez zmian wersji.
