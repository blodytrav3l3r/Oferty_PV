# Web UI/UX (zaadaptowano pod S.O.K.)

> Zrodlo: nextlevelbuilder/ui-ux-pro-max-skill v2.15.0 (79 styli / 50 active,
> 192 palety, 74 fonty, 119 UX guidelines, 105 ikon, 25 wykresow, 22 stacki;
> ux-guidelines.csv, pre-delivery checklist).
> Projekt: vanilla JS SPA (ADR-002), dark theme z tokenami w `style.base.css`, iframe'y
> w `app.html`. Wybrano reguly istotne dla wewnetrznego narzedzia B2B (formularze,
> tabele, toasty, modale) - odrzucono kategorie marketingowe (landing page, touch
> mobile-first, sustainability, AI interaction).

## Accessibility (priorytet)

| Regula                           | Do                                                                      | Nie                                                                        |
| -------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Kontrast**                     | Min. 4.5:1 dla tekstu normalnego, 3:1 dla duzego                        | Text w kolorze `--accent-text` (#a5b4fc) na `--bg-primary` bez weryfikacji |
| **Kolor to nie jedyny wskaznik** | Ikona/tekst OPROCZ koloru (np. status ERROR/WARNING ma ikone + tooltip) | Sam kolor tla wiersza jako jedyna informacja                               |
| **Alt text**                     | Opisowy alt dla znacznikych obrazow                                     | `alt=""` dla informacyjnych obrazow lub jego brak                          |
| **Hierarchia naglowkow**         | Sekwencyjne h1-h6 (jeden h1 na widok)                                   | Przeskakiwanie poziomow (h1 -> h4)                                         |
| **ARIA labels**                  | `aria-label` dla przyciskow z samą ikoną (toolbar, akcje wiersza)       | Przyciski ikonowe bez etykiety dostepnej                                   |
| **Nawigacja klawiatura**         | Tab order zgodny z wizualnym; widoczne focus ringi                      | Focus ukryty (`outline: none` bez zamiennika)                              |
| **Semantic HTML**                | Natywne elementy (`button`, `label`, `table`) + ARIA                    | Divy-kliki zamiast przyciskow                                              |
| **Etykiety formularzy**          | `<label for>` lub wrap input; widoczna etykieta                         | Placeholder jako jedyna etykieta                                           |
| **Komunikaty bledow**            | `aria-live`/`role="alert"` przy dynamicznych bledach                    | Bledy tylko w konsoli lub zmiana koloru                                    |
| **Skip link**                    | Link "Przejdz do tresci" na poczatku strony                             | Nawigacja bez mozliwosci pominiecia                                        |
| **Reduced motion**               | Szanuj `prefers-reduced-motion: reduce`                                 | Animacje bez wzgledu na ustawienia uzytkownika                             |

## Interaction (stany elementow)

| Regula                   | Do                                                                          | Nie                                                     |
| ------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Focus states**         | Widoczny focus ring na interaktywnych elementach                            | Brak wskazania fokusa klawiaturowego                    |
| **Hover states**         | Zmiana kursora (`cursor: pointer`) + subtelna zmiana (kolor/cien)           | Hover powodujacy przesuniecie layoutu (transform scale) |
| **Active/pressed**       | Wizualna zmiana po wcisnieciu (np. darken/cień)                             | Brak feedbacku klikniecia                               |
| **Disabled states**      | Zmniejszona opacity + `cursor: not-allowed`                                 | Disabled wygladajacy jak aktywny                        |
| **Loading buttons**      | Blokada przycisku + spinner podczas operacji                                | Podwojne klikniecie = podwojny submit                   |
| **Error feedback**       | Jasny komunikat bledu blisko problemu                                       | Cisza lub blad tylko w konsoli                          |
| **Success feedback**     | Komunikat sukcesu (toast) lub wizualna zmiana                               | Brak potwierdzenia zapisu                               |
| **Confirmation dialogs** | Potwierdzaj nieodwracalne akcje (DELETE oferty/studni, czyszczenie configu) | Usuwanie bez zapytania (por. PZ guardy)                 |

## Feedback (loading, empty, toasty)

| Regula                  | Do                                                         | Nie                                          |
| ----------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| **Loading >300ms**      | Spinner/skeleton dla operacji trwajacych >300ms            | Blank screen podczas oczekiwania             |
| **Empty states**        | Pomocny komunikat + akcja (np. "Brak ofert - utworz nowa") | Pusta tabela bez kontekstu                   |
| **Error recovery**      | Jasne kolejne kroki po bledzie                             | Komunikat "Cos poszlo nie tak" bez kontekstu |
| **Toast notifications** | Auto-dismiss po 3-5s (istniejace `showToast`)              | Toast wiszacy bez konca lub brak toastu      |

## Forms

| Regula                  | Do                                        | Nie                             |
| ----------------------- | ----------------------------------------- | ------------------------------- |
| **Input labels**        | Widoczna etykieta nad/przy inpucie        | Placeholder zamiast etykiety    |
| **Error placement**     | Blad pod zwiazanym inputem                | Wszystkie bledy na gorze strony |
| **Inline validation**   | Walidacja na blur dla wiekszosci pol      | Walidacja dopiero przy submit   |
| **Input types**         | Wlasciwe typy (`number`, `date`, `email`) | Wszystko jako `text`            |
| **Required indicators** | Asterisk lub "(wymagane)"                 | Brak wskazania pol wymaganych   |
| **Submit feedback**     | Loading -> sukces/blad                    | Brak reakcji po submit          |

## Navigation

| Regula           | Do                                                              | Nie                                 |
| ---------------- | --------------------------------------------------------------- | ----------------------------------- |
| **Active state** | Wskazanie aktywnego elementu nawigacji (router SPA juz to robi) | Brak podswietlenia biezacego modulu |
| **Deep linking** | URL odzwierciedla stan (hash routing `#/modul`)                 | Stan aplikacji niewidoczny w URL    |

## Layout

| Regula              | Do                                                      | Nie                                |
| ------------------- | ------------------------------------------------------- | ---------------------------------- |
| **Z-index scale**   | Uporzadkowana skala (10/20/30/50) dla modali/overlay    | Losowe z-index > 9999              |
| **Content jumping** | Rezerwuj miejsce na async content (skeleton/min-height) | Skok layoutu po zaladowaniu danych |

## Animation

| Regula                 | Do                                                         | Nie                               |
| ---------------------- | ---------------------------------------------------------- | --------------------------------- |
| **Duration 150-300ms** | Plynne przejscia (hover, modale, toasty)                   | Instant switch lub >500ms         |
| **Reduced motion**     | `@media (prefers-reduced-motion: reduce)` wylacza animacje | Animacje ignorujace ustawienia OS |

## Content & Search

| Regula                 | Do                                                                                          | Nie                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Number formatting**  | Separatory tysiecy, format walutowy PL                                                      | Surowe liczby bez formatowania                              |
| **Date formatting**    | Locale-aware format daty                                                                    | ISO string wyswietlany uzytkownikowi                        |
| **No results**         | "Brak wynikow" z sugestiami w wyszukiwarce (Excel filtr)                                    | Pusta lista bez komunikatu                                  |
| **Reflow tekstu**      | Tresc przeplywa bez clippingu (zoom, waskie ekrany); dlugie tokeny moga sie lamac           | `overflow: hidden` + `nowrap` bez dostepnej pelnej wartosci |
| **Przerwane animacje** | Po przerwaniu animacji stan koncowy, focus i tresc poprawne; timing per platforma/komponent | Animacja zostawia polstan (toast wisi, focus zgubiony)      |

## Anti-Patterns (typowe bledy UI)

| Anti-pattern                       | Dlaczego                     | Lepsze                                                 |
| ---------------------------------- | ---------------------------- | ------------------------------------------------------ |
| Kolor jako jedyny wskaznik statusu | Niewidoczne dla daltonistow  | Ikona + kolor + tooltip (wzorzec ERROR/WARNING studni) |
| Emoji jako ikony UI                | Niespojnosc, brak stylu      | Ikony SVG (Lucide, `lucide.createIcons`)               |
| Focus ukryty `outline: none`       | Brak nawigacji klawiaturowej | Widoczny focus ring                                    |
| Hover z transform scale            | Przesuniecie layoutu (jank)  | `transition` na color/background/box-shadow            |
| Disabled bez rozroznienia          | Bledne kliki                 | opacity + `not-allowed`                                |
| Toast bez auto-dismiss             | Zaslania UI                  | `showToast` z timeoutem 3-5s                           |

## Pre-Delivery Checklist

Przed dostarczeniem zmian UI:

- [ ] Kontrast tekstu >= 4.5:1 (dark tokens w `style.base.css`)
- [ ] Wszystkie klikalne elementy maja `cursor: pointer`
- [ ] Hover bez przesuwania layoutu, transitions 150-300ms
- [ ] Focus states widoczne dla nawigacji klawiaturowej
- [ ] `prefers-reduced-motion` respektowane
- [ ] Brak emoji jako ikon (Lucide zamiast emoji)
- [ ] Ikony tylko z Lucide (spojny zestaw 24x24)
- [ ] `escapeHtml` przy kazdej interpolacji do innerHTML (baza bledow #3)
- [ ] `aria-label` dla przyciskow z samymi ikonami
- [ ] Formularze z etykietami, bledy przy polu
- [ ] Empty states i "brak wynikow" z akcja
- [ ] Toast notifications z auto-dismiss
- [ ] Responsywnosc: brak poziomego scrolla, test 375/768/1024/1440
