# Audyt licencji — S.O.K. 1.64.26

Data audytu: 2026-11-24  
Wersja: `1.64.26`  
Tag: `v1.64.26`  
Commit: `6ecde6a1c369ef8d00aaae808b3c21102bb90b4b`

## Zakres i metoda

Audyt dotyczy snapshotu źródłowego przypiętego do wskazanego taga, nie obrazu
Docker ani gotowej instalacji. Weryfikacja repozytorium wykazała zgodność taga
z `HEAD`, wersją w `VERSION` i wersją w `package.json`. `package-lock.json`
wiąże zależności z konkretnymi wersjami, tarballami i sumami integralności.
`npm run licenses:check` przechodzi; kontrola potwierdza spójność plików
uzupełniających i wygenerowanego wykazu z lockfile, ale nie potwierdza praw
Licencjodawcy ani kompletności licencji dowolnego artefaktu.

Zakres uzgodniony do przygotowania: ZIP źródłowy. Nie obejmuje on gotowych
obrazów kontenerów ani hostowego Docker Desktop/Engine. Źródła zawierają jednak
Dockerfile i lockfile, z których nabywca może zbudować obrazy lub pobrać
zależności. Własne, konkretne obrazy wymagają osobnego wykazu według ich
rzeczywistego digestu i zainstalowanych pakietów systemowych.

## Potwierdzone składniki zewnętrzne

| Składnik                       | Wersja / licencja zadeklarowana                                            | Dowód i sposób postępowania                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SheetJS Community Edition      | 0.20.3 / Apache-2.0                                                        | `public/vendor/xlsx.full.min.js`; zachowany banner, pełny tekst Apache-2.0 i opis pochodzenia w `public/licenses/SheetJS-NOTICE.txt`.                                                                                                                                                                                                                                                                                                      |
| Inter                          | siedem statycznych plików WOFF2 / SIL OFL 1.1                              | Fonty w `public/css/fonts/`; dołączono tekst OFL. Zachować informację copyright i licencję; fontu nie obejmować licencją własnościową ani sprzedawać oddzielnie. [Tekst OFL Inter](https://github.com/google/fonts/blob/main/ofl/inter/OFL.txt).                                                                                                                                                                                           |
| Ikony Lucide / Feather         | subset bez zapisanej wersji / ISC oraz MIT dla ikon pochodzących z Feather | `public/js/shared/iconsSlim.js`; dołączono oba teksty. Brak wersji źródłowej subsetu uniemożliwia dokładne przypięcie pochodzenia. [Licencje upstream](https://lucide.dev/license).                                                                                                                                                                                                                                                        |
| `elkjs`                        | 0.11.1 / EPL-2.0 według lockfile i pakietu                                 | `package-lock.json`, kopia `LICENSE.md` w instalowanym pakiecie; źródło upstream: [tag v0.11.1](https://github.com/kieler/elkjs/tree/v0.11.1). Przy dystrybucji programu zachować EPL, informację o licencji i zapewnić rozsądny dostęp do odpowiadającego źródła zgodnie z § 3.1–3.3 EPL. Zależność jest `devOptional`; kwalifikacja „dev” nie oznacza, że nie może wystąpić w instalacji przez opcjonalną ścieżkę pakietu produkcyjnego. |
| `gitconfiglocal`               | 1.0.0 / BSD (pole `license` w lockfile)                                    | Tekst znajduje się w `public/licenses/npm/gitconfiglocal-1.0.0.txt`; nie uogólniać wariantu poza tekstem tej kopii. Zależność oznaczona `dev`.                                                                                                                                                                                                                                                                                             |
| `@prisma/dev`                  | 0.24.17 / ISC zadeklarowana w lockfile i metadanych paczki                 | Brak pliku licencji i noty copyright w paczce npm. Lokalny `public/licenses/npm/prisma-dev-0.24.17.txt` to jawnie oznaczony tekst kanoniczny z placeholderem, a nie oryginalna nota. Podmiot praw oraz zgodność warunków dla konkretnego tarballa pozostają **niepotwierdzone**; przed dystrybucją uzyskać pisemne potwierdzenie dostawcy albo usunąć tę zależność z dostarczanego artefaktu bez naruszenia instalacji.                    |
| Puppeteer i Chrome for Testing | Puppeteer 25.16.0; Chrome 156.0.8078.47 według lokalnego zapisu            | Licencję Puppeteer uzupełniają osobne warunki i credits samej przeglądarki. Zapis credits jest w `public/licenses/chrome-for-testing/156.0.8078.47/`; sprawdzić, czy wersja przeglądarki pobrana przy budowie odpowiada dokładnie tej wersji. W ZIP-ie źródłowym nie przekazuje się binarnego Chrome.                                                                                                                                      |

## Elementy, do których tytuł lub zgoda nie są potwierdzone

Poniższe ustalenia wynikają z repozytorium i odpowiedzi autora z 2026-11-24.
Repozytorium zawiera pliki, lecz nie jest dowodem praw do nich. Autor wskazał,
że ma wyłącznie ustne ustalenia w sprawie cenników i grafik oraz nie ma pełnej
ewidencji wkładu ludzkiego i warunków narzędzi AI. Nie traktować tego wykazu jako
zgody ani zapewnienia o prawach.

| Pozycja w snapshotcie                                                                                                                                   | Stan                                                                                                                                                                                                                       | Warunek przed przekazaniem                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/pricelists/active-pricelists.json`                                                                                                                | Plik jest wymagany przy świeżej instalacji; repozytorium nie zapisuje źródeł i warunków redystrybucji cen/danych. Autor zgłasza tylko ustne ustalenia.                                                                     | Uzyskać pisemne zezwolenia właściwych uprawnionych obejmujące dołączenie, instalację i użycie danych przez nabywcę; albo przygotować i sprawdzić równoważny plik danych z potwierdzonym źródłem. Bez tego ZIP nie jest zatwierdzony do przekazania. |
| `public/images/letterhead-header.png`, `letterhead-footer.png`, `logo-sok.svg`, `logo-sok-light.svg`, `transport-icon.jpg`, `ce-mark.png`, `b-mark.png` | Pochodzenie i zakres praw/zgód nie wynikają z plików. Materiały firmowe i oznaczenia mają ponadto odrębne ograniczenia użycia. Autor zgłasza wyłącznie ustne ustalenia.                                                    | Uzyskać pisemne prawa/zgody oraz, dla CE/B, potwierdzić właściwą podstawę użycia oznaczeń; albo wyłączyć grafiki, zastąpić je materiałem o potwierdzonych prawach i sprawdzić generowanie etykiet, PDF/DOCX oraz instalację.                        |
| Kod, dokumentacja, wcześniejsze wkłady i narzędzia AI                                                                                                   | `LICENSE` wskazuje Łukasza Kobyłkę, ale sam nagłówek nie dowodzi łańcucha praw. Dokumenty o pochodzeniu w repo dotyczą starszej wersji i zawierają oświadczenia autora. Autor potwierdził brak pełnej ewidencji AI/wkładu. | Przed oświadczeniem w umowie spisać znanych autorów/wykonawców, podstawę przeniesienia praw, narzędzia i zakres ludzkiego wkładu. Nie przedstawiać deklaracji o wyłącznym tytule jako niezależnie zweryfikowanego faktu.                            |
| `@prisma/dev@0.24.17`                                                                                                                                   | Licencja ISC jest deklarowana w metadanych, ale nie znaleziono oryginalnej noty praw do dokładnego tarballa.                                                                                                               | Uzyskać potwierdzenie dostawcy i właściwą notę lub wyłączyć pakiet po sprawdzeniu instalacji.                                                                                                                                                       |
| `iconsSlim.js`                                                                                                                                          | Zidentyfikowano rodziny licencji, lecz dokładny commit/wersja zestawu nie jest zapisany.                                                                                                                                   | Uzupełnić pochodzenie i wersję albo zachować jako pozycję nieustaloną.                                                                                                                                                                              |

## Wpływ na umowę i paczkę

Wzór `LICENSE` ogranicza zwykły użytek do osobistego i niekomercyjnego oraz
wymaga pisemnej zgody dla użytku komercyjnego i modyfikacji. Umowa z nabywcą
musi być tą konkretną pisemną zgodą i określać pola eksploatacji; licencja S.O.K.
nie może rozszerzać praw do składników zewnętrznych ponad ich własne warunki.

Zgodnie z warunkiem § 1 ust. 3 umowy pozycje o nieustalonym tytule nie mogą być
uznane za objęte licencją ani przekazane bez innej podstawy. Ponieważ aktywny
plik cenników jest wymagany do świeżej instalacji, a grafiki są wykorzystywane
w części dokumentów/etykiet, na podstawie aktualnych dowodów **nie można jeszcze
zatwierdzić ZIP-u jako paczki gotowej do wydania nabywcy**. Nie usunięto tych
plików z repozytorium ani nie zmieniono działania S.O.K.

Obowiązujący generated notice: [`THIRD-PARTY-NOTICES.md`](../THIRD-PARTY-NOTICES.md).
Pełne mapowanie lokalnych uzupełnień npm i ich sum kontrolnych:
[`public/licenses/npm/README.md`](../public/licenses/npm/README.md) oraz
[`public/licenses/npm/manifest.json`](../public/licenses/npm/manifest.json).
`npm run licenses:check` nie jest certyfikatem zgodności prawnej ani dowodem
posiadania praw.
