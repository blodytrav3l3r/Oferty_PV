# Assets — Dane źródłowe

Pliki w tym katalogu to biznesowe dane źródłowe wykorzystywane do importu cenników i konfiguracji.

## Zawartość

| Plik | Opis |
|---|---|
| `Cennik PRECO.csv` | Cennik produktów PRECO (format CSV do importu) |
| `Cennik PRECO.xlsx` | Cennik produktów PRECO (format Excel) |
| `Impuls_13.01.xlsm` | Makro Impuls v13.01 — dane konfiguracyjne studni |
| `Impuls_14.00.xlsm` | Makro Impuls v14.00 — dane konfiguracyjne studni |
| `Przejścia Impuls.xlsx` | Tabela przejść/włazów do systemu Impuls |
| `tabele.xlsx` | Dodatkowe tabele referencyjne |

## Uwagi

- Pliki `.xlsm` zawierają makra — wymagają włączenia makr w Excelu.
- Głównym źródłem danych produktowych w aplikacji jest `public/data/products_studnie.json`.
- Ten katalog nie jest serwowany przez aplikację — służy wyłącznie jako backup danych źródłowych.
