# Instalacja i przeniesienie S.O.K. na PostgreSQL 18

## Świeża instalacja

S.O.K. przenosi między komputerami tylko zatwierdzone, aktywne cenniki rur,
studni i PRECO. Oferty, klienci, użytkownicy, sesje, zamówienia, logi, szkice i
historyczne wersje cen nie są kopiowane.

- **Windows testowy:** rozpakuj kompletne repozytorium i uruchom
  `install-new-pc.bat`.
- **Linux serwerowy:** skopiuj kompletne repozytorium na Ubuntu/Debian i uruchom
  `sudo bash install-linux-server.sh`.

Oba instalatory używają pakietu
[`data/pricelists/active-pricelists.json`](../data/pricelists/active-pricelists.json).
Najpierw wykonują migracje PostgreSQL i seed, sprawdzają sumy SHA-256 pakietu,
importują trzy aktywne cenniki do pustego zakresu bazy, a potem uruchamiają
aplikację i czekają na gotowość. Nie wymagają starej instalacji, bazy SQLite,
ręcznego eksportu, przekazywania pliku ani potwierdzenia importu. Nie usuwają
istniejących wolumenów PostgreSQL.

## Kontrola pakietu cenowego

Kontrola struktury i hashy nie wymaga połączenia z bazą:

```powershell
$env:DATABASE_URL = 'postgresql://sok_test:sok_test@127.0.0.1:5432/sok_test?schema=public'
npx ts-node scripts/import-active-pricelists.ts data/pricelists/active-pricelists.json --validate-only
Remove-Item Env:DATABASE_URL
```

Instalatory wykonują kontrolę automatycznie. Import do istniejącej bazy z
cennikami jest blokowany, jeśli dane różnią się od pakietu.

## Backup i odtworzenie

Backup PostgreSQL twórz przez `npm run backup`; restore wykonuj tylko do jawnie
wskazanej, izolowanej bazy PostgreSQL przez `npm run restore` i
`RESTORE_DB_URL`. Pełny backup jest formatem odtworzenia tej samej instalacji,
nie sposobem przenoszenia danych do świeżej instalacji. Szczegóły i restore
drill opisuje [DEPLOYMENT.md](DEPLOYMENT.md).
