# Proces wydawniczy (Release Process)

## Krok po kroku

### 1. Przygotowanie wydania

```bash
git checkout develop
git pull
# Upewnij się, że wszystkie zmiany są zakomitowane
```

### 2. Branch release

```bash
git checkout -b release/2.1.0
```

### 3. Podbicie wersji

```bash
npm run release:patch  # lub :minor / :major
```

To wykona:

- Podbicie wersji w `VERSION` i `package.json`
- Aktualizację `CHANGELOG.md`
- Commita `chore(release): 2.0.1`
- Tag `v2.1.0`

### 4. Weryfikacja

```bash
npm run validate  # lint + typecheck + test
```

### 5. Merge do main

```bash
git checkout main
git merge --no-ff release/2.1.0
git push origin main --tags
```

### 6. GitHub Release

Push taga (`v2.1.0`) automatycznie uruchamia workflow `.github/workflows/release.yml`, który:

- Uruchamia testy
- Generuje GitHub Release z opisem z CHANGELOG

### 7. Merge z powrotem do develop

```bash
git checkout develop
git merge --no-ff release/2.1.0
git push origin develop
```

### 8. Usunięcie brancha release

```bash
git branch -d release/2.1.0
git push origin --delete release/2.1.0
```

## Hotfix

W sytuacji awaryjnej:

```bash
git checkout main
git checkout -b hotfix/2.0.1
# Naprawa błędu
npm run release:patch
git checkout main
git merge --no-ff hotfix/2.0.1
git push origin main --tags
git checkout develop
git merge --no-ff hotfix/2.0.1
git push origin develop
```
