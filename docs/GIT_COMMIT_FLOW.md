# Profesjonalny commit Git — instrukcja krok po kroku

### 1. Sprawdź co zmieniłeś

```bash
git status          # zobacz zmodyfikowane/nowe/usunięte pliki
git diff            # podgląd zmian (jeśli mało plików)
git diff --stat     # statystyka: ile linii zmienionych na plik
```

### 2. Staging — wybierz co idzie do commita

**Opcja A — wszystko:**
```bash
git add -A
```

**Opcja B — konkretne pliki (gdy są niechciane zmiany np. `data/seed*.json`):**
```bash
git add sciezka/pliku.ts sciezka/pliku2.html
```

**Opcja C — interaktywnie (sprawdź każdą zmianę przed dodaniem):**
```bash
git add -p
```

### 3. Walidacja przed commitem

```bash
npm run validate       # = typecheck + lint + testy
npm run format         # Prettier — sformatuj cały kod
```

Jeśli coś pada: popraw błędy i wróć do kroku 2.

### 4. Commit

**Krótki:**
```bash
git commit -m "typ(scope): opis"
```

**Dłuższy z ciałem:**
```bash
git commit -m "typ(scope): krótki opis

- szczegół 1
- szczegół 2
- powód zmiany (jeśli nieoczywisty)

Closes #12"
```

**Typy:** `feat` (nowa funkcja), `fix` (naprawa), `refactor`, `docs`, `chore` (techniczne), `perf`, `test`.

**Scope:** moduł/domena (np. `studnie`, `rury`, `import-export`, `api`).

**Opis:** imperatyw, polski, max 50-72 znaków.

### 5. Push

```bash
git push                    # jeśli main
git push --follow-tags      # jeśli są nowe tagi (release)
git push -u origin nazwa-brancha   # jeśli nowy branch
```

### 6. Release (tylko przy wersji)

```bash
npm run release:patch   # małe poprawki
npm run release:minor   # nowe funkcje
npm run release:major   # breaking changes
git push --follow-tags
```

### Skrócony flow (codzienny)

```bash
git add -A
npm run validate && npm run format
git commit -m "feat(studnie): dodaj przycisk eksportu XLSX"
git push
```

### Obejście Husky (gdy pre-commit blokuje)

```bash
git -c core.hooksPath=/dev/null commit -m "feat(scope): opis"
```
