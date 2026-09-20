# §8a input — audyt ścieżki etykiet / negatywnego feedbacku (ML)

**Status:** audit input, NIE plan implementacyjny. Bez decyzji, bez implementacji.
**Źródła:** kod (ścieżka `user action → label → AiFeature`) + kopia produkcji `backup_2026-09-11` (read-only).
**Kontekst:** F1/F2 (mechanika, `cb6223b`) + Etap 0 (wariant B: 857× SKIPPED, 0 SUCCESS) + F3 (`02b378b`) zamknięte.

## Ustalenie 1 — REJECTED = 0: sygnał nieosiągalny, nie nieobsłużony

- Backend obsługuje REJECT (`telemetryAiMl.ts:286` → `wasRejected` → `updateLabelByTelemetry(..., 'REJECTED')`).
- Jedyny nadawca: `_signalAiOverrideOrModify` (`public/js/studnie/actionsCrud.js:13`) — tylko gdy `prevConfigSource === 'AUTO_AI'`.
- `AUTO_AI` tylko gdy AI realnie zmieniło wybór (`solverAutoSelect.js:150`, warunek z linii 1340). Frontend mapuje je na `AI_SUGGEST` (`telemetryBridge.js:300`).
- Produkcja: **0 wierszy `AI_SUGGEST`** (AUTO_JS 5612 / MANUAL 1971), **0 flag `wasRejected`**, **0 rewardów REJECT** (`aiRewardLog`: ACCEPT 565 / MODIFY 34).
- Brak ścieżki `accepted: false` w całym frontendzie.
- Wniosek: problemem nie jest backend, tylko **brak osiągalnego/regularnego sygnału odrzucenia**.

## Ustalenie 2 — MODIFIED = 32: semantyka poprawna, liczność nie

- Ścieżka działa: reward MODIFY → `wasModified` na sugestii → `resync` → MODIFIED (32 etykiety ≈ 34 rewardy).
- Flaga `wasModified` stoi na 779 wierszach, ale etykietę dostają tylko modyfikacje sugestii — edycje konfiguracji MANUAL to z definicji `NO_FEEDBACK` (`FeatureExtractor.ts:180`). `wasModified` ≠ `MODIFIED`.
- 32 negatywy (waga 0.5) wobec 620 pozytywów — za mało na balans klas.

## Ustalenie 3 — NO_FEEDBACK = 5881: trzy strumienie bez follow-up

- AUTO_JS generuje obserwacje przy każdej zmianie (5612), nagroda ACCEPT dociera rzadko (565): batch tylko ze zweryfikowaną telemetrią, cap 50 studni, filtr `WELL_NOT_FOUND`, MANUAL wykluczone.
- MANUAL (1971) to z definicji `NO_FEEDBACK` bez jawnego `wasAccepted` (`FeatureExtractor.ts:180`).
- Celowo nie traktujemy finalnego MANUAL jako REJECT (komentarz `offerSave.js:168-173`) — automatyczny negatyw zafałszowałby etykietę własnego wyboru użytkownika.

## Kolejność na przyszłość (nie decyzje)

Dane → balans klas → mechanizm zbierania negatywów → dopiero progi → trening → walidacja. Progi 50/100/300 bez zmian do tego czasu.

## Hipotezy do oceny w planie §8a (NIE decyzje)

- REJECT osiągalny także poza `AUTO_AI`.
- Doprecyzowanie, kiedy MODIFIED jest wiarygodnym negatywem.
- Rola `wasAiRanked` w kwalifikacji sygnałów.
- Ewentualna kalibracja progów — dopiero po powyższym.
