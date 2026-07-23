# Zasady pracy — WITROS Oferty PV

## Codzienna praca

- Pracujesz na `main` — to jedyna gałąź.
- Commit: `git add -A` → `git commit -m "typ(scope): opis"` → `git push`
- Przed commitem: `npm run typecheck` i `npm run lint`
- Po modyfikacji kodu frontendowego: `npm run format`
- **Uwaga:** Husky pre-commit hook może blokować commity (znany błąd z `well.magazyn`). Obejście:
    ```bash
    git -c core.hooksPath=/dev/null commit -m "typ(scope): opis"
    ```

## Workflow

1. Utwórz branch z `main` (jeśli zadanie jest złożone)
2. Wprowadź zmiany
3. Uruchom `npm run validate` (typecheck + lint + testy)
4. Uruchom `npm run format`
5. Utwórz commit zgodny z [Conventional Commits](https://www.conventionalcommits.org/):
    - `feat(scope):` — nowa funkcjonalność
    - `fix(scope):` — naprawa błędu
    - `refactor(scope):` — refaktoryzacja
    - `docs(scope):` — zmiany w dokumentacji
    - `chore(scope):` — zadania techniczne (zależności, konfiguracja)
6. Push na `main`

## Release

```bash
npm run release:patch   # Małe poprawki
npm run release:minor   # Nowe funkcje (zgodne wstecz)
npm run release:major   # Zmiany przełamujące kompatybilność
git push --follow-tags
```

Proces release:

1. `npm run release` automatycznie dobiera typ wersji na podstawie commitów
2. Aktualizuje `VERSION`, `package.json`, `CHANGELOG.md`
3. `scripts/auto-cache-bust.mjs` automatycznie aktualizuje `?v=` we wszystkich HTML do nowej wersji
4. Tworzy tag git
5. Po pushu tagów GitHub automatycznie tworzy Release

**Uwaga:** Nie zmieniaj ręcznie parametrów `?v=` w HTML — są synchronizowane z `VERSION` podczas release.

## Świeża instalacja

Przy pierwszym uruchomieniu na nowym komputerze (bez istniejącej bazy danych):

1. Sklonuj lub pobierz projekt z GitHub:
    ```bash
    git clone https://github.com/blodytrav3l3r/Oferty_PV.git
    cd Oferty_PV
    ```
2. Uruchom instalator:
    ```bash
    .\install.bat   # Windows
    bash install.sh # Linux
    ```
    Instalator: skopiuje `.env`, zainstaluje zależności, skonfiguruje bazę i załaduje dane początkowe (produkty, cenniki, konto admina).
    Po pierwszym uruchomieniu serwera automatycznie odczytany jest plik `data/price_defaults.json`
    (jeśli istnieje) zawierający snapshot domyślnych cenników — pozwala przenieść niestandardowe
    ceny z innej instalacji.
3. Uruchom serwer:
    ```bash
    .\start.bat
    ```
4. Zaloguj się na http://localhost:3000 (admin / hasło z `.env`).

> **UWAGA:** Nie uruchamiaj `start.bat` przed `install.bat` na świeżej instalacji.
> `start.bat` automatycznie seeduje pustą bazę przez `ensure-db.bat`, ale `install.bat`
> wykonuje pełną konfigurację (.env, zależności, migracje) — bez niego aplikacja nie zadziała.

## Przenoszenie bazy między urządzeniami

Podczas pracy z istniejącą bazą cenników na nowym urządzeniu:

1. Na starym urządzeniu wykonaj `npm run backup`
2. Skopiuj plik `data/backups/backup_*.sqlite` na nowe urządzenie
3. Na nowym urządzeniu wykonaj instalację z pominięciem seedowania:
    ```bash
    .\install.bat --skip-seed   # Windows
    bash install.sh --skip-seed  # Linux
    ```
4. Przywróć bazę z backupu (restore automatycznie synchronizuje schemat):
    ```bash
    npm run restore data/backups/backup_*.sqlite
    ```
5. Uruchom serwer:
    ```bash
    .\start.bat
    ```
6. Upewnij się, że `DEFAULT_ADMIN_PASSWORD` w `.env` jest zgodne z poprzednią instalacją.
7. (opcjonalnie) Jeśli chcesz przenieść niestandardowe ceny domyślne (rury, studnie, preco),
   skopiuj plik `data/price_defaults.json` ze starego urządzenia do katalogu `data/` na nowym.
   Zostanie automatycznie przywrócony przy starcie serwera.

    > **Lżejsza alternatywa:** Jeśli potrzebujesz przenieść tylko ceny (bez ofert/zamówień),
    > wystarczy skopiować `data/price_defaults.json` i uruchomić `start.bat` — nie jest
    > potrzebny backup SQLite ani `--skip-seed`.

## Dependabot

Na GitHubie otwórz PR → zielony przycisk "Squash and merge". Tyle.

## Testy

```bash
npm test                 # Wszystkie testy
npm run test:quick       # Tylko testy dymne (szybkie)
npm run test:watch       # Watch mode
```

Przed mergem upewnij się, że wszystkie testy przechodzą.

## Formatowanie i lint

```bash
npm run format           # Prettier — automatyczne formatowanie
npm run format:check     # Sprawdź formatowanie
npm run lint             # ESLint
npm run lint:fix         # ESLint z auto-naprawą
```

## Kod frontendowy

- Kod w `public/js/` nie jest sprawdzany przez TypeScript ani ESLint
- Zawsze weryfikuj składnię: `node -c public/js/<plik>.js`
- Nowe globalne helpery rejestruj przez `window.mojHelper = mojHelper;`
- Używaj `escapeHtml(str)` przy interpolacji do `innerHTML` (zapobieganie XSS)
- Po dynamicznym wstrzyknięciu HTML z ikonami Lucide wywołaj: `lucide.createIcons({root: container})`

### Kodowanie polskich znaków (encoding policy)

| Typ pliku                          | Kodowanie           | Uwagi                                              |
| ---------------------------------- | ------------------- | -------------------------------------------------- |
| `.ts`, `.js`, `.mjs`, `.cjs`       | **UTF-8 (bez BOM)** | Standard dla Node.js/TypeScript                    |
| `.html`, `.css`, `.json`           | **UTF-8 (bez BOM)** | Standard webowy                                    |
| `.md`, `.txt`                      | **UTF-8 (bez BOM)** | Dokumentacja                                       |
| `.sh`, `.ps1`                      | **UTF-8 (bez BOM)** | Skrypty powłoki                                    |
| `.bat`, `.cmd`                     | **ASCII-only**      | Brak polskich znaków — cmd.exe nie obsługuje UTF-8 |
| `.yaml`, `.yml`, `.sql`, `.prisma` | **UTF-8 (bez BOM)** | Pliki konfiguracyjne i migracje                    |

**Zasady:**

- W plikach `.bat` NIE używaj polskich znaków ani znaków spoza ASCII (np. `—` em dash). Zastąp je odpowiednikami ASCII (`-` zamiast `—`, `l` zamiast `ł`, `s` zamiast `ś` itp.).
- We wszystkich pozostałych plikach używaj swobodnie polskich znaków w UTF-8.
- Unikaj BOM (Byte Order Mark) na początku plików UTF-8.
