# Instalacja WITROS Oferty w trybie offline

## Wymagania
- Node.js (wersja 18 lub nowsza)
- npm (zawarty w Node.js)
- Python 3.x (opcjonalnie, tylko dla backendu AI)
- Docker (opcjonalnie)

## Instrukcja instalacji

### Windows:
1. Uruchom `install.bat` jako administrator
2. Serwer będzie dostępny pod adresem: http://localhost:3000

### Linux/macOS:
1. Uruchom: `chmod +x install.sh`
2. Uruchom: `./install.sh`
3. Serwer będzie dostępny pod adresem: http://localhost:3000

## Weryfikacja instalacji
- `node --version`
- `npm --version`
- Sprawdź folder `dist/` po zakończeniu instalacji
- Dostępne są przykładowe pliki w `project_files/`

## Uwagi
- Wszystkie zależności są pobierane z cache npm zawartego w pakiecie
- Bez potrzeby dostępu do internetu podczas instalacji
- Aby zaktualizować, wymagany jest dostęp do internetu lub nowy pakiet offline
