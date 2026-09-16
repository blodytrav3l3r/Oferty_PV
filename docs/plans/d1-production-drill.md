# D1 — Produkcyjny restore drill (runbook operatora)

> **Status: BLOCKED — manual production action required.**
> Drill manualny na maszynie produkcyjnej. Dev drill PASS na izolowanej kopii
> (`docs/plans/d1-restore-drill.md`) NIE jest równoważny z produkcją.
> Backup uznaje się za bojowy na prod dopiero po wykonaniu tego runbooka.

Szczegółowe procedury tła w `docs/BACKUP_RESTORE.md` i `docs/DEPLOY_UPDATE.md` —
ten runbook ich nie duplikuje, tylko odwołuje się do nich w krokach.

Logika bramek z `scripts/restore-db.js:108-146` (kolejność: magic → checksum →
integrity → kopia → re-integrity → migrate; każdy FAIL = `exit(1)`).
Backup z `scripts/backup.ts` (`VACUUM INTO`, sidecar `.sha256`, retencja 30 plików `.sqlite`).

## 1. Warunki wstępne

- [ ] Okno serwisowe ogłoszone (aplikacja ZATRZYMANA na czas drillu, por. `docs/DEPLOY_UPDATE.md` §4).
- [ ] Operator ma dostęp do maszyny prod, uprawnienia do zatrzymania/startu aplikacji i odczytu `data/backups/`.
- [ ] Wybrany backup docelowy istnieje: `data/backups/backup_<YYYY-MM-DD>_<ts>.sqlite` + sidecar `.sha256`.
- [ ] Weryfikacja świeżości PRZED startem (RPO 24 h — backup nie starszy niż 1 dzień od crona dziennego):
    ```bash
    dir data\backups\backup_*.sqlite
    ```
    Oczekiwane: najnowszy plik z ostatniej doby. Brak świeżego backupu = STOP.
- [ ] Weryfikacja SHA PRZED startem (nie nadpisuje bazy, sam odczyt):
    ```bash
    certutil -hashfile data\backups\<wybrany>.sqlite SHA256
    type data\backups\<wybrany>.sqlite.sha256
    ```
    Oczekiwane: hashe identyczne. Rozjazd = STOP (plik uszkodzony/podmieniony).
- [ ] Zanotowany aktualny tag wersji (`git describe --tags` lub `data/deploy-log.log`) — potrzebny do wycofania.
- [ ] **Krok 0 obowiązkowy:** backup bieżącego stanu PRZED restore (skrypt restore NIE robi kopii bezpieczeństwa — najsłabszy punkt wykryty w dev drillu, scenariusz (e)).

## 2. Procedura

| #   | Komenda                                                                                                           | Oczekiwany wynik                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | `npm run backup`                                                                                                  | `[Backup] Utworzono: data/backups/backup_....sqlite`, `[Backup] SHA-256: ...`, `Weryfikacja integralności OK`. Zapisz nazwę pliku — to punkt wycofania.                                |
| 1   | Zatrzymaj aplikację (por. `docs/DEPLOY_UPDATE.md` §4: Ctrl+C / `pm2 stop sok-oferty` / `docker compose stop`)     | Zero aktywnych zapisów. Proces nie odpowiada na porcie 3000.                                                                                                                           |
| 2   | `npm run restore data\backups\<wybrany>.sqlite` + odpowiedź `tak` na prompt                                       | Kolejno: `[OK] Suma SHA-256 backupu zgodna.` (lub WARN o braku sidecara dla backupu legacy — dopuszczalne), brak `[BLAD]`, `Baza przywrocona z: ...`, `[OK] Schemat zsynchronizowany.` |
| 3   | `npx prisma migrate status`                                                                                       | `Database schema is up to date` / brak oczekujących migracji. Rozjazd schematu = STOP + wycofanie.                                                                                     |
| 4   | Uruchom aplikację (por. `docs/DEPLOY_UPDATE.md` §6: `start.bat --prod` / `pm2 start` / `docker compose up -d`)    | Proces startuje bez błędów w logu.                                                                                                                                                     |
| 5   | `npm run deploy:check` (smoke `/health`)                                                                          | HTTP 200, `backup`/`version`/`dbVersion` zgodne. Brak odpowiedzi po 2 próbach = STOP + wycofanie.                                                                                      |
| 6   | Smoke danych: zaloguj się, otwórz ofertę rur i studni, przetestuj eksport (por. `docs/DEPLOY_UPDATE.md` §4 pkt 4) | Oferty otwierają się, liczby/pozycje zgodne ze stanem z backupu. Pusta baza lub brak danych = STOP + wycofanie.                                                                        |

Uwagi do kroku 2 (z dev drillu):

- Magiczny nagłówek SQLite NIE wystarcza (plik ucięty do 50% przechodzi magic, łapie go dopiero `integrity_check`) — FAIL na tym etapie oznacza `[BLAD] Backup nie przeszedl PRAGMA integrity_check`.
- Podmiana 1 bajta = `[BLAD] Suma SHA-256 backupu niezgodna` + `exit(1)` BEZ nadpisania bazy.
- Błąd `migrate deploy` po restore = `[WARN] Nie udalo sie zsynchronizowac schematu` + `exit(1)`, ale kopia pliku JUŻ się odbyła — dlatego krok 0 jest obowiązkowy.

## 3. Kryteria PASS całości

Drill PASS, gdy spełnione ŁĄCZNIE:

1. Kroki 0–6 wykonane bez STOP.
2. `migrate status` czysty, `/health` 200, smoke danych zgodny z backupem.
3. Zmierzone RTO (od kroku 1 do kroku 6) wpisane do tabeli wyników. Estymacja z dev: 5–15 min (weryfikacja ~10 s na pliku 1,3 GB + migrate + restart); wartość produkcyjna może się różnić (dysk/sieć).

## 4. Kryteria STOP i wycofanie

STOP (przerwij, nie idź dalej) przy którymkolwiek:

- Brak świeżego backupu (RPO przekroczone) lub SHA PRZED startem niezgodna.
- Restore kończy się `[BLAD]` + `exit(1)`: checksum FAIL, integrity FAIL (przed lub po kopii), `isSqliteFile` FAIL, migrate FAIL.
- `/health` nie odpowiada po 2 próbach lub smoke danych pokazuje pustą/niespójną bazę.

Procedura wycofania (punkt wycofania = backup z kroku 0):

```bash
npm run restore data\backups\<backup-z-kroku-0>.sqlite
npx prisma migrate status
npm run deploy:check
```

Następnie: smoke danych jak w kroku 6, otwarcie aplikacji dla pracowników dopiero po PASS smoke. Nieudany wycof = eskalacja wg `docs/DEPLOY_UPDATE.md` §5 (rollback do poprzedniego tagu, log `data/deploy-log.log`).

## 5. Wynik operatora

| Data | Operator | Backup użyty | RTO zmierzone (krok 1→6) | Wynik PASS/FAIL | Uwagi |
| ---- | -------- | ------------ | ------------------------ | --------------- | ----- |
|      |          |              |                          |                 |       |
