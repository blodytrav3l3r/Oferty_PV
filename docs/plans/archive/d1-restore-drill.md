# D1 — Restore drill (izolowana kopia dev, 2026-09-16)

Drill wykonany w `C:\Users\blody\AppData\Local\Temp\opencode\d1-drill\`.
Żywa baza i `data/backups/*` tylko do odczytu. `scripts/restore-db.js`
nie był uruchamiany — kroki odwzorowują jego logikę 1:1
(`isSqliteFile`, `verifyChecksum`, `integrityCheck`).

Źródło: `backup_2026-09-12_1789193421800.sqlite` (1255,1 MB) + sidecar `.sha256`.
Logika z `scripts/backup.ts` (retencja tylko `.sqlite`, sidecar SHA-256,
`PRAGMA integrity_check` po VACUUM INTO) i `scripts/restore-db.js:108-146`
(kolejność bramek: magic → checksum → integrity → kopia → re-integrity → migrate).

## Wyniki

| Scenariusz                                                | Wynik                                   | Czas                                                               | Wniosek                                                                                                                                                                                                                   |
| --------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) poprawny backup → pełna ścieżka PASS                  | PASS (magic true, SHA OK, integrity ok) | kopia 6657,9 ms; magic 2 ms; SHA 1220,3 ms; integrity 2218,3 ms    | bramki przepuszczają zdrowy backup; suma ścieżki weryfikacji ~10,1 s                                                                                                                                                      |
| (b) podmieniony 1 bajt (offset 100000)                    | CHECKSUM FAIL (wykryty)                 | SHA 1268,5 ms; magic nadal true                                    | podmiana wykryta przed kopiowaniem; restore zakończyłby się `exit(1)` bez nadpisania bazy                                                                                                                                 |
| (c) brak sidecara `.sha256`                               | WARN + kontynuacja (legacy)             | 0,1 ms                                                             | ścieżka `restore-db.js:63-66` działa; starsze backupy (bez sidecara) nadal odtwarzalne                                                                                                                                    |
| (d) plik ucięty do 50% (627,5 MB)                         | INTEGRITY FAIL (wykryty)                | zapis 1271,3 ms; check 0,6 ms (`database disk image is malformed`) | magiczny nagłówek NIE wystarcza (true mimo ucięcia) — dopiero `integrity_check` łapie; kolejność bramek w skrypcie jest poprawna                                                                                          |
| (e) zła wersja / mismatch migracji — ocena statyczna kodu | WYKRYTY, ale PO nadpisaniu              | n/d (nie odpalano migrate)                                         | `runPrisma(['migrate','deploy'])` (`restore-db.js:132-146`); błąd = twardy `exit(1)`, brak cichego restore — ale kopia `copyFileSync` (linia 119) już się odbyła; brak backupu bieżącej bazy przed nadpisaniem w skrypcie |

## RTO / RPO (ESTYMACJA z tempa, nie produkcja)

- RPO ≈ 24 h — backup z crona dziennego (`npm run backup:install-cron`); maksymalnie jeden dzień roboczy do odtworzenia.
- RTO ≈ 5–15 min — zmierzone: weryfikacja ~10 s (kopia 6,7 s + SHA 1,2 s + integrity 2,2 s) na pliku 1,3 GB; reszta to margines na: `migrate deploy` (niezmierzone w drillu), restart aplikacji, ręczne potwierdzenie i odnalezienie backupu.
- Zastrzeżenia: pomiary z maszyny dev (NVMe, cache OS); produkcja (dysk/sieć) może być wolniejsza; backup testowany z 2026-09-12 (4 dni przed drillem).

## Obserwacje dodatkowe

- Backupi od 2026-09-04 urosły 765 MB → 1,3 GB (wcześniej 10–50 MB) — do sprawdzenia przyczyna wzrostu (osobny temat, nie blokuje D1).
- Najsłabszy punkt skryptu: brak kopii bezpieczeństwa bieżącej bazy przed `copyFileSync` — operator ma robić `npm run backup` przed restore.

## Werdykt

**Backup BOJOWY na dev (drill PASS).** Wszystkie bramki weryfikacji działają zgodnie z kodem.
**Warunek produkcyjnego drillu manualnego:** wykonać na produkcji przed oznaczeniem backupu jako bojowego na prod —
pełna ścieżka z `scripts/restore-db.js`, po uprzednim `npm run backup` bieżącego stanu, z pomiarem czasu `migrate deploy`.
