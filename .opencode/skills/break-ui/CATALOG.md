# Katalog najgorszych przypadków

Realne wartości, które psują UI — pogrupowane po typie renderowanej wartości.
Weź wiersze pasujące do pól z tabeli Fazy 1. Każda wartość jest czymś, co realny
użytkownik może wyprodukować; kolumna „Psuje" mówi, co się zwykle wysypuje.

Dla e-maili i URL-i używaj `example.com` / `.test`, żeby dane nie wskazywały
na prawdziwą skrzynkę ani stronę.

Źródło: `emilkowalski/skills` (break-ui/CATALOG.md), MIT.

---

## Ludzie i nazwy

| Wartość                                | Psuje                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| `Aleksandra Wiśniewska-Kowalczyk`      | Długa, z łącznikiem; zawija się na dwie linie, łącznik to punkt łamania      |
| `Christopher Alexander Montgomery III` | Długie z sufiksem; naiwne inicjały dają `CI`                                 |
| `Konstantin Oberhauser-Wettstein`      | Długie i złożone; przelewa się w wierszu jednolinijkowym                     |
| `Jo`                                   | Dwie litery; naiwne inicjały dają `J`                                        |
| `J`                                    | Jedna litera; bardzo mały target kliknięcia, jeśli nazwa jest linkiem        |
| `Ólafur Darri Ólafsson`                | Wiodąca akcentowana duża litera; logika sortowania i inicjałów               |
| `Đặng Thị Ngọc Hân`                    | Piętrowe diakrytyki; ucinane przez ciasny `line-height` + `overflow: hidden` |
| `王秀英`                               | CJK bez spacji; „pierwsze + ostatnie słowo" znajduje jedno słowo             |
| `Seán O'Brien-Ó Súilleabháin`          | Apostrof i akcenty; escapowanie, inicjały, wyszukiwanie                      |
| `María José de la Cruz y Fernández`    | Małe partykuły; inicjały `Md` lub `MF`                                       |
| `dana`                                 | Same małe litery; inicjały nadal powinny być wielkie                         |
| `🦊 Fox`                               | Emoji na początku; `.charAt(0)` zwraca połowę pary zastępczej (`�`)          |
| `👩🏽‍💻 Priya`                             | Sekwencja ZWJ; `.length` ma 7+, cięcie dzieli emoji                          |
| ` Sam   Lee`                           | Spacje wiodące, końcowe i podwójne; inicjały z pustych słów                  |
| _(brak)_                               | Brak nazwy, sam e-mail; UI musi mieć fallback                                |

## E-maile, URL-e, identyfikatory

Ciągi bez punktów łamania: nie ma gdzie zawinąć.

| Wartość                                                                                                   | Psuje                                                              |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `bartholomew.fitzgerald@northwind-industries-holdings.example.com`                                        | Klasyk. Bez `overflow-wrap: anywhere` wypycha rodzeństwo z wiersza |
| `a@b.co`                                                                                                  | Najkrótszy realny; layout zakładający długi e-mail wygląda pusto   |
| `first.last+billing-notifications@example.com`                                                            | Plus-adresowanie; walidacja odrzucająca `+`                        |
| `ops@sub.department.region.example.co.uk`                                                                 | Wiele subdomen, dwuczłonowy TLD; logika „wyciągnij domenę"         |
| `https://example.com/workspaces/acme/projects/q3-launch/docs/9f8e7d6c5b4a?tab=comments&filter=unresolved` | Długi URL; ucięcie na końcu chowa to, co się różni                 |
| `9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f`                                                                    | UUID; szerokość monospace, kandydat do cięcia w środku             |
| `Oferta — ZAM/2026/10/000148 (poprawiona) v12 [zatwierdzona].pdf`                                         | Nazwa pliku; cięcie na końcu chowa numer i rozszerzenie            |
| `IMG_20250914_183022_HDR_portrait_edited_edited.HEIC`                                                     | Nazwa z aparatu; bez łamania, wielkie rozszerzenie                 |

## Etykiety, tytuły, teksty z danych

| Wartość                                                       | Psuje                                                      |
| ------------------------------------------------------------- | ---------------------------------------------------------- |
| `Kierownik Działu Projektowania i Infrastruktury Podziemnej`  | Długi tytuł stanowiska; trzy linie w polu drugorzędnym     |
| `Zaproszenie wygasło 12 dni temu`                             | Długi badge statusu; zawija się albo ściska kolumnę nazwy  |
| `Benachrichtigungseinstellungen`                              | Niemiecki złożeniec (30 znaków bez spacji)                 |
| `Paramètres de confidentialité et de sécurité`                | Francuskie rozwinięcie; tekst ~30% dłuższy w tłumaczeniu   |
| Dwanaście tagów na jednym rekordzie                           | Rząd tagów zawijający się w ścianę; potrzebne `+8`         |
| `customer-feedback-from-enterprise-onboarding` jako jeden tag | Tag szerszy niż kontener                                   |
| `Untitled` / pusty string / `   `                             | Brak tytułu; zapadnięty nagłówek, wiersz zerowej wysokości |
| `<script>alert(1)</script>` / `&amp;` / `**pogrubienie**`     | Escapowanie; musi renderować się jako literał              |
| `Linia pierwsza` + newline + `Linia druga`                    | Newline w polu jednolinijkowym; podwaja wysokość wiersza   |
| Opis 2 000 znaków wklejony z Worda                            | Clamp, „pokaż więcej", rozrost textarea                    |

## Liczby i kwoty

| Wartość                                        | Psuje                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| `0`                                            | Stany zerowe: „0 monitów", pusty pasek postępu, dzielenie przez 0      |
| `1`                                            | Odmiana: „1 monitów" zamiast „1 monit"                                 |
| `1284`                                         | Potrzebny separator tysięcy: `1 284` (pl-PL = spacja nierozdzielająca) |
| `1000000`                                      | Szerokość badge'a licznika                                             |
| `12345678.9` jako kwota                        | `12 345 678,90 zł`; przelewa kolumnę sum                               |
| `-42.5`                                        | Znak minus, logika czerwieni, nawiasy w formacie księgowym             |
| `0.1 + 0.2`                                    | `0.30000000000000004` renderowane surowo                               |
| `142%` / `-3%`                                 | Paski postępu poza zakresem                                            |
| `null` / `undefined` / `NaN`                   | Renderowane dosłownie                                                  |
| `1.284` w `de-DE` vs `1,284` w `en-US`         | Formatowanie locale; twarde separatory są złe dla połowy świata        |
| `1284.5` z API, `1 284,50` w UI                | Mieszanie kropki i przecinka (baza błędów #4)                          |
| Wartość zmieniająca się na żywo (`99` → `100`) | Skok szerokości bez `tabular-nums`                                     |

## Kolekcje

| Wartość                                | Psuje                                                          |
| -------------------------------------- | -------------------------------------------------------------- |
| 0 elementów                            | Stan pusty — i czy w ogóle istnieje                            |
| 1 element                              | „1 z 1", siatka wyglądająca na zepsutą                         |
| Dokładnie rozmiar strony i rozmiar + 1 | Off-by-one w „Pokazano 40 z 40", pusta strona 2                |
| 1 000+ elementów bez paginacji         | Wydajność scrolla, czas renderu, pamięć; „Pokazano 40 z 1 284" |
| Jeden element 10× większy od innych    | Wiersze gridu rozciągnięte do najwyższego                      |
| Elementy o identycznych nazwach        | Listy, gdzie nazwa jest jedynym rozróżnikiem                   |

## Czas

| Wartość                                    | Psuje                                                            |
| ------------------------------------------ | ---------------------------------------------------------------- |
| Teraz                                      | „0 sekund temu" zamiast „przed chwilą"                           |
| 12 dni temu, 11 miesięcy temu, 3 lata temu | Progi czasu względnego; po tygodniu przełącz na datę bezwzględną |
| Data w przyszłości                         | „za 3 dni" vs „-3 dni temu"                                      |
| `1970-01-01`                               | Zerowy timestamp pokazany jako realna data                       |
| `2025-12-31T23:30:00-08:00`                | Inny dzień w UTC i w strefie użytkownika                         |
| Bardzo długi czas trwania (`1 284 h`)      | Formatowanie, które nigdy nie zwija się do dni                   |

Używaj `Intl.RelativeTimeFormat` i `Intl.DateTimeFormat('pl-PL')`, nie ręcznych stringów.

## Obrazy i media

| Wartość                                   | Psuje                                                   |
| ----------------------------------------- | ------------------------------------------------------- |
| URL obrazka zwraca 404                    | Ikona złamanego obrazka zamiast fallbacku               |
| Brak obrazka                              | Sam fallback: inicjały, kolor, parytet rozmiaru         |
| Panorama 4000×200 jako miniatura          | Zniekształcenie bez `object-fit: cover`                 |
| Obraz 200×4000                            | To samo w drugiej osi; potrafi rozsadzić wysokość karty |
| Przezroczysty PNG, ciemny logotyp w light | Niewidoczne na tle                                      |
| Wolno ładujący się obrazek                | Layout shift bez stałych wymiarów lub `aspect-ratio`    |

## Stany

| Wartość                      | Psuje                                                               |
| ---------------------------- | ------------------------------------------------------------------- |
| Ładowanie                    | Skeletony niepasujące do finalnego layoutu                          |
| Błąd z API                   | Brak stanu błędu albo surowy komunikat (`TypeError: …`)             |
| Dane częściowe               | Część pól opcjonalnych wypełniona, część nie — rozjechane wiersze   |
| Wszystkie statusy naraz      | Wszystkie wartości enuma w jednej liście; badge'y różnej szerokości |
| Brak uprawnień               | Akcje `disabled`; czy wiersz nadal się układa tak samo?             |
| Bieżący użytkownik na liście | Etykiety „Ty", akcje, które nie powinny go dotyczyć                 |

## Środowisko

Nie dane, ale sprawdzane tak samo: włącz najgorszy przypadek, potem zmień te warunki.

| Warunek                          | Psuje                                                        |
| -------------------------------- | ------------------------------------------------------------ |
| Kontener 320px                   | Wszystkie powyższe przelewy naraz                            |
| Wąski panel boczny               | Komponenty projektowane full-width w kolumnie 280px          |
| 2560px szerokości                | Zbyt długie linie tekstu, treść osierocona po jednej stronie |
| Zoom 200% / duży tekst systemowy | Stałe wysokości ucinające rosnący tekst                      |
| Motyw ciemny i jasny             | Gołe kolory, niewidoczne obramowania i logotypy              |
| Urządzenie dotykowe              | Akcje tylko na hover (menu `•••`) są nieosiągalne            |
