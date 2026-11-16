# Licencje zależności i kontrola dystrybucji

Stan przeglądu: 2026-11-15, kod bazowy `9576be7d`, wersja aplikacji 1.58.1.
Dokument obejmuje istniejące warianty Docker oraz instalacje Windows i Linux;
nie jest potwierdzeniem zgodności dowolnego przyszłego artefaktu.

## Źródła i zakres

- [`THIRD-PARTY-NOTICES.md`](../THIRD-PARTY-NOTICES.md) zawiera deterministyczną listę deklaracji z lockfile, opis obowiązków i ograniczeń. Oznaczenia prod/dev nie dowodzą zawartości konkretnego artefaktu.
- [`public/licenses/npm/README.md`](../public/licenses/npm/README.md) mapuje dołączone teksty do konkretnych wersji i źródeł upstream. Oryginalne pliki nie są tłumaczone ani zastępowane szablonami.
- Dockerfile uruchamia `npm ci` bez usunięcia zależności deweloperskich i pobiera Chrome for Testing. Obraz zawiera też bazowy system Debian i `postgresql-client-18`; Compose uruchamia dodatkowy kontener `postgres:18-alpine`. Ich wersje i licencje nie są w pełni opisane przez lockfile npm.
- Windows: `install-new-pc.bat` korzysta z Docker Desktop, instalowanego i akceptowanego osobno przez użytkownika; nie jest on dołączany do S.O.K. `install.bat` jest ścieżką deweloperską uruchamiającą `npm ci`.
- Linux: instalator pobiera Docker Engine, containerd, buildx i Compose plugin z aktualnego repozytorium dostawcy. Nie są częścią obrazu S.O.K., a ich wersje mogą zmieniać się między instalacjami.
- Zbudowano lokalnie obraz audytowy aplikacji 1.58.1 dla `linux/amd64`: manifest `sha256:dd04427dd415286605332baa34eca5e2e17958bcc9263edbbd21c70ad9d4322a`; obraz bazowy `node:22-slim` wskazał digest `sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee`. To build z bieżącego working tree, nie wydanie opublikowane. Obraz PostgreSQL Compose i czyste instalacje hosta Windows/Linux nie były częścią tego builda.
- Lokalny obraz Compose `postgres:18-alpine` miał manifest `sha256:10a5c69a83035ab5239f5620d708520e8b28f5aa1f2b20143e6024532edadfb5`, Alpine 3.24.3 i `postgresql18-18.7-r0` (deklarowana licencja PostgreSQL). W sprawdzonych katalogach `/usr/share` i `/usr/local/share` nie znaleziono pliku licencji/copyright; pełny tekst z oryginalną notą dodano do [`public/licenses/PostgreSQL.txt`](../public/licenses/PostgreSQL.txt). Nie sprawdzono kompletu licencji pozostałych pakietów Alpine.
- Raport z obrazu wskazał 32 lokalnie zainstalowane pakiety npm bez pliku `LICENSE`/`COPYING` w katalogu głównym oraz 53 pozycje lockfile niedostępne w instalacji Linux (część to warianty innych platform). W obrazie znaleziono 226 plików `copyright` w `/usr/share/doc`. To diagnostyka, a nie kompletna inwentaryzacja każdej treści licencyjnej.
- W obrazie znaleziono pliki `LICENSE` przeglądarki i `LICENSE.headless_shell`; wyszukiwanie plików `credits` i `NOTICE` w cache Puppeteer nie zwróciło wpisów. Chrome credits pozostają niezweryfikowane.
- Nie audytowano czystego artefaktu instalatora Windows ani Linux na docelowym systemie. Instalator Windows polega na osobnym Docker Desktop; instalator Linux pobiera hostowe składniki Docker z bieżącego repozytorium. Nie są one częścią obrazu aplikacji.
- Dla każdego wydania należy ustalić, jakie pliki i obrazy są faktycznie przekazywane odbiorcy oraz jakie licencje i noty obejmują ich dokładne wersje i digesty. Aktualne obrazy nie pinują digestów, a pakiety apt pobierane są z bieżących repozytoriów.

## Weryfikacja przed przekazaniem wydania

1. Uruchom `npm run licenses:generate`, a następnie `npm run licenses:check`. Druga komenda porównuje wygenerowany dokument; **nie** sprawdza kompletności licencji ani zgodności prawnej.
2. W gotowym środowisku wykonaj `node scripts/generate-licenses.mjs --installed-report` i zachowaj wynik z identyfikatorem obrazu, platformą oraz wersją aplikacji. Raport wskazuje pakiety bez osobnego pliku licencji w katalogu głównym i pakiety nieobecne lokalnie; sprawdź też README, nagłówki i upstream, ponieważ brak pliku nie dowodzi braku tekstu.
3. Porównaj raport z zawartością każdego przekazywanego obrazu lub pakietu. Zachowaj odpowiednie pełne teksty licencji, oryginalne informacje copyright i mające zastosowanie pliki NOTICE. W przypadku licencji alternatywnych udokumentuj wybraną ścieżkę.
4. Dla składników objętych EPL-2.0 lub MPL-2.0 sprawdź obowiązki dotyczące dostępu do odpowiedniego kodu źródłowego, not i zmian dla konkretnej dystrybucji. Zapewnij odbiorcom wymagane informacje i dostęp przed wydaniem.
5. Osobno sprawdź prawa i informacje dla Chrome for Testing, obrazu bazowego, bibliotek systemowych, PostgreSQL, fontów, ikon i innych zasobów spoza lockfile. Nie utożsamiaj licencji biblioteki Puppeteer z licencjami przeglądarki.

## Otwarte kwestie przeglądu 2026-11-15

- `@prisma/dev@0.24.17` deklaruje ISC, lecz pakiet w obrazie zawiera tylko `package.json` i `dist/`; nie znaleziono oryginalnego pełnego tekstu licencji z notą copyright. Ustalić je u autora/dostawcy albo usunąć tę zależność z przekazywanego artefaktu, jeśli nie jest potrzebna.
- 32 pakiety npm obecne w obrazie nie mają osobnego `LICENSE`/`COPYING` w katalogu głównym. Dla każdego ustalić i udostępnić pełny tekst oraz copyright/NOTICE właściwej wersji; obecne `public/licenses/npm/` obejmuje tylko wybrane przypadki.
- `elkjs@0.11.1` jest obecny w obrazie z `lib/` i `LICENSE.md`, więc źródłowe pliki pakietu i tekst EPL-2.0 są zawarte w obrazie. Przed dystrybucją potwierdzić, że ten sposób przekazania źródeł i informacji jest właściwy dla odbiorców oraz danego modelu dystrybucji.
- Dla konkretnej wersji Chrome for Testing znaleziono pliki `LICENSE` przeglądarki i headless shell, ale kompletności atrybucji komponentów nadal nie potwierdzono. Dokumentacja Chromium opisuje mechanizm [`about:credits`](https://chromium.googlesource.com/chromium/src.git/+/HEAD/docs/adding_to_third_party.md); obraz audytowy nie wykazał pełnego pliku credits.
- Osobno trzeba sprawdzić pełne teksty dla pakietów Alpine w obrazie PostgreSQL, systemowe pakiety obrazu aplikacji po dokładnych wersjach, Chrome credits oraz hostowe zależności Windows/Linux. Aktualny digest obrazu PostgreSQL jest zapisany wyżej jako dowód lokalnego audytu, ale Compose używa ruchomego tagu, więc przyszłe buildy mogą mieć inną zawartość. Pakiety hostowe również nie są przypięte do wersji niezmiennych.

Źródła warunków: [MIT](https://opensource.org/license/mit), [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0), [Blue Oak 1.0.0](https://blueoakcouncil.org/license/1.0.0), [EPL-2.0](https://www.eclipse.org/legal/epl-2.0/) i [MPL-2.0](https://www.mozilla.org/en-US/MPL/2.0/). Obowiązują teksty odpowiednich licencji i konkretny sposób korzystania oraz przekazywania składników.

Pochodzenie kodu, wykaz narzędzi AI i elementy o nieustalonym statusie prawnym: [`POCHODZENIE_KODU_I_AI.md`](POCHODZENIE_KODU_I_AI.md).
