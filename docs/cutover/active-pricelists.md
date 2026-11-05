# Pakiet aktywnych cenników PostgreSQL

Nowe instalacje S.O.K. na Windows i Linux używają wersjonowanego pakietu
[`data/pricelists/active-pricelists.json`](../../data/pricelists/active-pricelists.json).
Plik zawiera po jednej zatwierdzonej aktywnej wersji cennika rur, studni i PRECO,
ich pozycje i konieczne aktywne override'y. Nie zawiera ofert, klientów,
użytkowników ani historii wersji.

Instalatory budują obraz, uruchamiają migracje PostgreSQL i seed, walidują
pakiet oraz jego SHA-256 przez `scripts/import-active-pricelists.ts`, importują
cenniki do pustego zakresu i dopiero potem uruchamiają aplikację. Importer
sprawdza liczniki, statusy, kompletność tabel oraz hash każdej wersji i całości.
Nie pobiera cen z SQLite ani nie wymaga pliku wyeksportowanego ze starego
komputera.

## Weryfikacja pakietu

Można sprawdzić strukturę i sumy pakietu lokalnie bez połączenia z bazą:

```powershell
$env:DATABASE_URL = 'postgresql://sok_test:sok_test@127.0.0.1:5432/sok_test?schema=public'
npx ts-node scripts/import-active-pricelists.ts data/pricelists/active-pricelists.json --validate-only
Remove-Item Env:DATABASE_URL
```

Instalator wykonuje tę kontrolę automatycznie, a następnie importuje do nowej
bazy PostgreSQL. Importer odmawia zapisania pakietu do bazy z istniejącymi
wersjami cenników; przy niezgodności niczego nie nadpisuje ani nie kasuje.

## Utrzymanie cen

Zmiana wartości wymaga aktualizacji pakietu w kontrolowanym wydaniu. Zachowaj
identyfikatory oraz statusy aktywnych wersji, policz ponownie SHA-256 zgodnie z
`scripts/import-active-pricelists.ts` i sprawdź `prices:verify`, import na
izolowanym PostgreSQL 18, tworzenie oferty oraz eksport XLSX. Nie umieszczaj
sekretów ani danych klientów w pakiecie.
