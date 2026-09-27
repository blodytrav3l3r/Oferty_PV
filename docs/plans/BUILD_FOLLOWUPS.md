# BUILD follow-ups (odroczone z BUILD 2026-09-27, nie blokery)

## F1 — Uproszczenie UX studni (P3.2)

Przepływ Parametry → Auto → Weryfikacja → Cena → Oferta, reszta w Zaawansowane.
**Dlaczego odroczone:** dotyka strefy Excel + głównego panelu (150 modułów, shared renderery); wymaga testów z realnym użytkownikiem i screenshotów przed/po. Niebezpieczne autonomicznie.

## F2 — Pełny dashboard operacyjny UI (P3.1)

Źródła gotowe (`/metrics`: requests/p95/db/audit/storage + `ml-status` lineage).
**Dlaczego odroczone:** nowy UI (HTML+JS+uprawnienia) to ~300 linii bez zweryfikowanego zapotrzebowania; najpierw potwierdzić, które metryki są używane.

## F3 — Migracja writerów snapshotów na kopertę v1 (P1.5 cont.)

Helper + read-side gotowe (`src/utils/snapshots.ts`, `audit.ts` lista).
**Dlaczego odroczone:** każdy writer (audit create/update, rebuild, telemetry snapshots, offer blobs) ma własnych czytelników; migracja per plik z testami round-trip, nie hurtem.

## F4 — Dataset fingerprint + solver/rules version w lineage (P1.3/P3.3 cont.)

Wymaga zmiany schematu (`AiModel`/run: hash datasetu, solverVersion, rulesVersion) + wersjonowania stałych solvera po stronie backendu (dziś pochodzą z payloadu frontendu).
**Dlaczego odroczone:** migracja schematu + pipeline; potrzebna decyzja o formacie fingerprintu.
