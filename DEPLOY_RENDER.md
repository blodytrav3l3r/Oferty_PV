# Deployment na Render.com

## Szybki start (Blueprint)

Najszybsza metoda — Render automatycznie odczyta `render.yaml` z repo.

1. **Dashboard Render** → "New" → "Blueprint"
2. Wskaż repo: `https://github.com/blodytrav3l3r/Oferty_PV`
3. Render wykryje `render.yaml` i zaproponuje konfigurację
4. Kliknij "Apply" — Render utworzy Web Service + Persistent Disk
5. Po utworzeniu przejdź do **Environment** i ustaw:
   - `DEFAULT_ADMIN_PASSWORD` (np. `MojeTajneHaslo123!`)
6. Deploy rozpocznie się automatycznie

Po zakończeniu deployu aplikacja będzie dostępna pod adresem `https://witros-oferty.onrender.com`.

## Co Render robi automatycznie

| Krok | Komenda |
|---|---|
| 1. Instalacja zależności | `npm ci` |
| 2. Generowanie Prisma Client | `npx prisma generate` |
| 3. Kompilacja TypeScript | `npm run build` (`tsc`) |
| 4. Symlink `dist/generated` → `../generated` | `ln -sf ../generated dist/generated` (wymagane — prisma client szuka ścieżki `../generated/prisma` z `dist/src/`) |
| 5. Synchronizacja schematu bazy (przy starcie) | `npx prisma db push --skip-generate` |
| 6. Start serwera | `node dist/server.js` |

> **Uwaga:** `prisma db push` uruchamia się przy **każdym starcie** aplikacji (w startCommand). Jest idempotentny — dla niezmienionego schematu to no-op (~100ms).

## Persistent Disk

SQLite wymaga trwałego storage. Render Persistent Disk (1 GB, $1/mies.) jest automatycznie montowany w `/var/data`.

Baza danych: `/var/data/app_database.sqlite` — **przetrwa redeploy i restarty**.

## Health Check

Render sprawdza endpoint `/health` co 30 sekund. Jeśli aplikacja nie odpowiada, Render restartuje kontener.

## Ręczne ustawienie (alternatywa dla Blueprint)

1. **Dashboard Render** → "New" → "Web Service"
2. Wskaż repo: `https://github.com/blodytrav3l3r/Oferty_PV`
3. Ustaw:
   - **Runtime**: Node
   - **Build Command**: `npm ci && npx prisma generate && npm run build`
   - **Start Command**: `node dist/server.js`
   - **Health Check Path**: `/health`
4. Dodaj **Environment Variables**:
   - `NODE_ENV=production`
   - `HOST=0.0.0.0`
   - `DATABASE_URL=file:/var/data/app_database.sqlite`
   - `DEFAULT_ADMIN_PASSWORD=<twoje-hasło>`
5. Dodaj **Disk**:
   - Name: `witros-data`
   - Mount Path: `/var/data`
   - Size: 1 GB
6. Kliknij "Create Web Service"

## Logowanie i debugowanie

| Akcja | Gdzie |
|---|---|
| Logi build | Dashboard → Logs → "Build" |
| Logi runtime | Dashboard → Logs → "Live" |
| Shell w kontenerze | Dashboard → "Shell" |
| Restart | Dashboard → "Manual Deploy" → "Clear build cache & deploy" |

## Wymuszenie świeżej bazy

Jeśli chcesz zresetować bazę danych (usunąć wszystkie oferty/zamówienia):

1. Dashboard → Disk → "Delete Disk"
2. Utwórz nowy Disk (ten sam mount path)
3. Aplikacja automatycznie utworzy pustą bazę przy następnym deployu

## Częste problemy

### Build failuje na `prisma generate`

Sprawdź czy `DATABASE_URL` jest ustawione w Environment Variables (nawet tymczasowo, np. `file:./dev.db`).

### Build failuje na `tsc`

Sprawdź logi build. Jeśli błąd typów — uruchom lokalnie `npx tsc --noEmit` i napraw.

### Aplikacja startuje ale `/health` failuje

Sprawdź czy `PORT` nie jest hardcoded — Render ustawia dynamicznie. `server.ts` czyta z `process.env.PORT` ✅.

### Baza danych jest pusta po deployu

Sprawdź czy Persistent Disk jest zamontowany w `/var/data` i czy `DATABASE_URL=file:/var/data/app_database.sqlite`.

### Czy mogę używać PostgreSQL zamiast SQLite?

Tak, ale wymaga:
- Zmiany `provider` w `prisma/schema.prisma` z `sqlite` na `postgresql`
- Migracji istniejących danych
- Podłączenia Render PostgreSQL Database

To większy refactor — obecne rozwiązanie z Persistent Disk jest najprostsze dla single-instance deployment.

## Koszty

| Zasób | Koszt |
|---|---|
| Render Web Service (Starter) | $7/mies. |
| Render Persistent Disk 1 GB | $1/mies. |
| **Razem** | **$8/mies.** |

Free tier: Render oferuje darmowy tier, ale Persistent Disk nie jest dostępny. Dane będą się resetować co 15 min przy inactivity.
