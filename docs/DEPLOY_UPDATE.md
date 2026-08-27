# Aktualizacja (Deploy) — S.O.K.

**Wersja:** 1.19.6
**Stack:** Express + Prisma + SQLite + VanillaJS SPA
**Ostatnia aktualizacja:** 2026-08-24

---

## 1. Cel i zasady

Niniejszy dokument opisuje bezpieczny proces aktualizacji aplikacji produkcyjnej, na której
pracują pracownicy. Aktualizacje wykonuje się w **oknie serwisowym** (poza godzinami pracy) —
**dłuższa przerwa jest akceptowalna**. Główny wymóg: **żadnej utraty danych**.

Zasady nadrzędne:

- Produkcja pobiera **wyłącznie tagowane wydania** (`vX.Y.Z`) — nigdy surowy `main`.
- **Backup przed każdą operacją** (`npm run backup` — VACUUM INTO, spójny snapshot).
- Migracje są **addytywne** (`npx prisma migrate deploy`). **Zakaz** `db push --accept-data-loss` na produkcji.
- Baza seeduje się **tylko gdy jest pusta** — dane pracowników nigdy nie są nadpisywane.
- Przed jakąkolwiek akcją uruchom **podgląd** (`--dry-run`) — zobaczysz kroki bez dotykania systemu.

Dane (baza SQLite `data/app_database.sqlite`) żyją wyłącznie na maszynie produkcyjnej.
Kod i dane są fizycznie rozdzielone.

## 2. Wymagania wstępne (raz, na maszynie prod)

1. Node.js >= 22.13, git, npm (Linux dodatkowo PM2).
2. Repozytorium sklonowane na produkcji: `git clone https://github.com/blodytrav3l3r/Oferty_PV.git`.
3. Konto admina i `.env` skonfigurowane (zob. `docs/DEPLOYMENT.md`).
4. Auto-backup włączony **zanim pojawią się dane**:
    - Windows: `npm run backup:install-cron`
    - Linux: cron `0 3 * * * cd /sciezka && npm run backup`
    - Docker: cron hosta na katalog `./data/backups/`

## 3. Narzędzia

| Plik                            | Rola                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `scripts/deploy-core.cjs`       | Rdzeń logiki (testowalny) — kroki, walidacje, backup, health                      |
| `scripts/deploy.mjs`            | Deploy: `node scripts/deploy.mjs <windows\|linux\|docker> vX.Y.Z [--dry-run]`     |
| `scripts/rollback.mjs`          | Rollback: `node scripts/rollback.mjs <windows\|linux\|docker> vX.Y.Z [--dry-run]` |
| `scripts/post-deploy-check.mjs` | Smoke check: `npm run deploy:check`                                               |
| `deploy.bat` / `deploy.sh`      | Wrappery Windows/Linux                                                            |
| `rollback.bat` / `rollback.sh`  | Wrappery Windows/Linux                                                            |

Logi deploys zapisywane są do `data/deploy-log.log`.

## 4. Procedura aktualizacji (okno serwisowe)

> Pracownikom podaj komunikat np. „Przerwa techniczna od 17:00".

```
1. ZATRZYMAJ aplikację (zero aktywnych zapisów w trakcie migracji):
   - Windows: Ctrl+C w oknie start.bat --prod
   - Linux:   pm2 stop sok-oferty
   - Docker:  docker compose stop
2. Podgląd kroków (nic nie zmienia):
   node scripts/deploy.mjs <target> vX.Y.Z --dry-run
3. Właściwy deploy (wykonuje automatycznie, fail-fast):
   node scripts/deploy.mjs <target> vX.Y.Z
   [auto] backup -> git fetch tag vX.Y.Z -> git checkout -> npm ci
        -> prisma generate -> migrate deploy -> build -> version:check
        -> start -> health check (npm run deploy:check)
4. Smoke test: zaloguj się, otwórz ofertę rur i studni, przetestuj eksport.
5. Sukces -> otwórz dla pracowników.
   Porażka -> ROLLBACK (sekcja 5).
```

Deploy przerywa się przy pierwszym błędzie (fail-fast) — kolejne kroki nie są wykonywane,
a baza pozostała nietknięta (backup powstał przed jakąkolwiek zmianą).

## 5. Rollback (powrót do poprzedniej wersji)

```
1. node scripts/rollback.mjs <target> <poprzedni_tag> --dry-run   # podgląd
2. node scripts/rollback.mjs <target> <poprzedni_tag>
   [auto] restore bazy z najnowszego backupu (z auto migrate deploy)
        -> git checkout <poprzedni_tag> -> build -> start -> health check
3. Smoke test i otwarcie dla pracowników.
```

Rollback przywraca dokładnie ten stan (wersja + dane), który był przed nieudanym deploy.
Poprzedni tag odczytasz z logu: `data/deploy-log.log`.

## 6. Specyfika środowiska

### 6.1 Windows

- Start: `start.bat --prod` (proces w konsoli).
- Stop: Ctrl+C; przy zablokowanym porcie 3000 skrypt sam pyta o zatrzymanie procesu.
- Deploy: `deploy.bat windows vX.Y.Z` (lub `node scripts/deploy.mjs windows vX.Y.Z`).
- Pliki `.bat` są ASCII-only — logi z `deploy.mjs` pisane są po polsku w UTF-8.

### 6.2 Linux (VPS)

- Start/stop przez PM2: `pm2 start dist/server.js --name sok-oferty` (raz),
  potem `pm2 stop` / `pm2 start` / `pm2 restart sok-oferty`.
- PM2 uruchamia aplikację automatycznie po restarcie maszyny (pracownicy nie tracą dostępu w nocy).
- Deploy: `./deploy.sh linux vX.Y.Z` — dodatkowo kopiuje klienta Prisma do `dist/`.
- HTTPS: Caddy/Nginx + Let's Encrypt (zob. `docs/DEPLOYMENT.md` §4).

### 6.3 Docker

- `docker compose.yml` używa **bind mount `./data:/var/data`** (nie named volume) —
  dzięki temu backup/restore działają wprost na hoście jak na bare-metal.
- Start/stop: `docker compose up -d` / `docker compose stop`.
- Deploy: `node scripts/deploy.mjs docker vX.Y.Z` — buduje obraz i startuje (`up -d --build`).
- `entrypoint.sh` sam wykonuje `migrate deploy` przy starcie kontenera.
- **Zakaz `docker compose down -v`** (kasuje dane).

#### Migracja istniejącego wolumenu `sok_data` → bind mount (tylko raz)

```
1. docker compose stop
2. mkdir data
3. docker run --rm -v sok_data:/from -v <absolutna_sciezka>/data:/to alpine:3.20 sh -c "cp -a /from/. /to/"
4. Weryfikacja sum: sha256sum bazy w wolumenie i w ./data (identyczne)
5. docker compose up -d --build
```

Retencja: nie usuwaj starego wolumenu przez minimum 2 cykle release.

## 7. Pierwszy deploy (raz, zanim pojawią się dane pracowników)

1. Instalacja na maszynie prod (Windows `install.bat` / Linux wg `docs/DEPLOYMENT.md` / Docker).
2. Baza:
    - **Masz już dane** -> na dev: `npm run backup`; przenieś plik na prod; `npm run restore data/backups/backup_*.sqlite`.
    - **Start od zera** -> seed automatyczny przy pustej bazie.
3. `git checkout vX.Y.Z` — start od pierwszego tagu, nie od `main`.
4. `NODE_ENV=production`, `COOKIE_SECURE=true`, `TRUST_PROXY=1`, HTTPS reverse proxy.
5. Auto-backup włączony od razu (sekcja 2).
6. Weryfikacja checklistą w `docs/DEPLOYMENT.md` §7.

## 8. Release nowej wersji (na komputerze dev)

```
praca -> npm run validate -> npm run format -> npm run version:check
     -> commit -> git push
     -> npm run release:patch|minor|major
     -> npm run version:check (EXIT=0)
     -> git push --follow-tags
```

Release automatycznie podbija `VERSION`, `package.json`, `CHANGELOG.md`, cache-bust `?v=`
i wersje w `.bat`. **Nigdy nie taguj gita ręcznie** i nie edytuj `?v=` ręcznie.

## 9. Rozwiązywanie problemów

| Problem                           | Postępowanie                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `Niepoprawny tag`                 | Tag musi mieć format `vX.Y.Z` (np. `v1.16.0`). Sprawdź: `git tag -l`.                                              |
| `Katalog roboczy NIE jest czysty` | Na produkcji nie może być lokalnych zmian. Commituj/usuń zmiany przed deploy.                                      |
| `Brak backupów`                   | Wykonaj `npm run backup` ręcznie. Rollback bez backupu jest blokowany.                                             |
| `migrate deploy` błąd             | Baza może być typu legacy (`db push`). Sprawdź `npx prisma migrate status` i postępuj wg `docs/DEPLOYMENT.md` §9.  |
| `/health` nie odpowiada po deploy | Uruchom `npm run deploy:check` ponownie (serwer może się jeszcze podnosić). Brak efektu -> rollback.               |
| Baza "zseedowana na nowo"         | `check-db.js` seeduje tylko pustą bazę. Jeśli widzisz pustą bazę zamiast danych pracowników -> ROLLBACK z backupu. |
