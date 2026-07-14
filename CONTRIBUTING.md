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
