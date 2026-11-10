# Aktualizacja wdrożenia S.O.K.

**Wersja:** 1.56.14<br>
**Status:** PostgreSQL 18 jest jedynym backendem S.O.K. Wydanie 1.56.4 przeszło
lokalne bramki i testy PG18; rollout produkcyjny nadal wymaga zatwierdzonego GO,
backup/restore planu dla konkretnego środowiska oraz odrębnej walidacji instalacji
Linux.

Ten dokument zastępuje dawną procedurę opartą o lokalny plik bazy. Kanoniczna
instrukcja wdrożeń i bramek migracji znajduje się w
[docs/DEPLOYMENT.md](DEPLOYMENT.md). Nie stosuj zachowanych historycznych
komend deployu i rollbacku opartych o kopiowanie lokalnego pliku ani `db push`.

## Docelowa ścieżka aktualizacji

Po zatwierdzeniu konkretnego wdrożenia:

1. Potwierdź zielone `npm run version:check`, `npm run validate`, `npm run format`
   oraz workflow PostgreSQL 18 na dokładnym commicie.
2. Wykonaj PostgreSQL backup (`npm run backup`), sprawdź checksum i przeprowadź
   restore drill na izolowanym celu.
3. Wdróż aplikację, zastosuj wyłącznie wersjonowane migracje przez
   `npx prisma migrate deploy`, wykonaj smoke test i sprawdź monitoring backupu.
4. Wykonaj produkcyjny cutover wyłącznie po osobnym GO. Przy przejściu ze starej
   bazy zachowuj tylko aktywne cenniki według
   [docs/cutover/active-pricelists.md](cutover/active-pricelists.md).

Nie odtwarzaj pełnej starej bazy i nie importuj historii ofert, użytkowników,
sesji, zamówień ani cenników archiwalnych. Nie uruchamiaj migracji/seedu na
produkcyjnej bazie bez odrębnego upoważnienia.

## Diagnostyka

- Sprawdź status PostgreSQL i migracji: `npx prisma migrate status`.
- Sprawdź gotowość aplikacji: `GET /health/ready`.
- Zweryfikuj cenniki: `npm run prices:verify`.
- Backup i restore: [docs/DATABASE.md](DATABASE.md) oraz
  [docs/instalacja-przenoszenie-systemu.md](instalacja-przenoszenie-systemu.md).

Jeśli te procedury różnią się od [docs/DEPLOYMENT.md](DEPLOYMENT.md), stosuj
kanoniczny dokument wdrożenia.
