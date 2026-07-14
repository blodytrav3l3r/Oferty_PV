# Audyt seed_studnie.json — 2026-07-05

## Kontekst

Plik `data/seed_studnie.json` zawiera 676 produktów studni w mieszanym formacie:

- **297 produktów** (44%) ma stare polskie nazwy pól (np. `"Pow. wewn. m²"` zamiast `"area"`)
- **379 produktów** (56%) ma już angielskie nazwy pól lub nie wymaga pól area/zelbet

Skutek: produkty z polskimi kluczami zapisują się do bazy SQLite z `area = NULL`, `doplataZelbet = NULL` itd., przez co:

- Wkładka PEHD nie jest naliczana dla 297 produktów (dennice, konusy, kręgi, płyty, pierścienie)
- Dopłata żelbet nie jest naliczana dla 95 dennicy
- Kinety mają puste wartości dla zakresów wysokości i cen

## Statystyki — stare klucze do konwersji

| Stary klucz (PL) | Nowy klucz (EN) | Produktów | Dotknięte typy komponentów                                                                       |
| ---------------- | --------------- | --------- | ------------------------------------------------------------------------------------------------ |
| `Pow. wewn. m²`  | `area`          | 297       | dennica(95), kineta(20), konus(18), krag_ot(24), pierscien_odciazajacy(5), plyta_*(22), rura(13) |
| `Pow. zewn. m²`  | `areaExt`       | 277       | dennica(95), konus(18), krag_ot(24), pierscien_odciazajacy(5), plyta_*(22)                       |
| `Dopłata Żelbet` | `doplataZelbet` | 95        | dennica(95)                                                                                      |
| `Wys. spocznika` | `spocznikH`     | 20        | kineta(20)                                                                                       |
| `Hmin 1 mm`      | `hMin1`         | 20        | kineta(20)                                                                                       |
| `Hmax 1 mm`      | `hMax1`         | 20        | kineta(20)                                                                                       |
| `Cena 1 PLN`     | `cena1`         | 20        | kineta(20) — UWAGA: istnieje już `cena1` (nie nadpisuje)                                         |
| `Hmin 2 mm`      | `hMin2`         | 12        | kineta(12)                                                                                       |
| `Hmax 2 mm`      | `hMax2`         | 12        | kineta(12)                                                                                       |
| `Cena 2 PLN`     | `cena2`         | 20        | kineta(20) — UWAGA: istnieje już `cena2` (nie nadpisuje)                                         |
| `Hmin 3 mm`      | `hMin3`         | 8         | kineta(8)                                                                                        |
| `Hmax 3 mm`      | `hMax3`         | 8         | kineta(8)                                                                                        |
| `Cena 3 PLN`     | `cena3`         | 20        | kineta(20) — UWAGA: istnieje już `cena3` (nie nadpisuje)                                         |

## Produkty wymagające normalizacji

297 unikalnych produktów, łącznie 829 starych kluczy do usunięcia.

### Podział wg typu komponentu

| componentType         | Liczba | Przykłady ID                       |
| --------------------- | ------ | ---------------------------------- |
| dennica               | 95     | DDD-10-045, DDD-10-055, DDD-10-060 |
| kineta                | 20     | KINETA-DN1000-12, KINETA-DN1000-23 |
| konus                 | 18     | K-08-060, K-10-060                 |
| krag_ot               | 24     | KOT-10-100, KOT-10-050             |
| rura                  | 13     | R-10-100, R-10-150                 |
| pierscien_odciazajacy | 5      | PO-10-100, PO-10-050               |
| plyta_din             | 9      | PD-10-100                          |
| plyta_redukcyjna      | 5      | PR-10-100                          |
| plyta_zamykajaca      | 5      | PZ-10-100                          |
| plyta_najazdowa       | 4      | PN-10-100                          |
| plyta_nastudzienna    | 2      | PNS-10-100                         |
| plyta                 | 1      | P-10-100                           |

## Wpływ na działanie aplikacji

| Funkcja              | Działa?                          | Po normalizacji |
| -------------------- | -------------------------------- | --------------- |
| PEHD dla dennica     | ❌ (brak area → doplataPEHD = 0) | ✅              |
| PEHD dla konus       | ❌ (brak area)                   | ✅              |
| PEHD dla krag        | ❌ (brak area)                   | ✅              |
| PEHD dla plyta       | ❌ (brak area)                   | ✅              |
| Żelbet dla dennica   | ❌ (brak doplataZelbet)          | ✅              |
| Kineta - zakresy cen | ❌ (brak hMin/hMax/cena)         | ✅              |

## Sposób naprawy

1. Uruchom: `node scripts/normalize-seed-studnie.mjs --apply`
2. Backup: `data/seed_studnie.json.bak`
3. Reseed bazy: `DELETE FROM productsStudnie; DELETE FROM categoriesStudnie;` + restart backendu
