# Zasady pracy — WITROS Oferty PV

## Codzienna praca

- Pracujesz na `main` — to jedyna gałąź.
- Commit: `git add -A` → `git commit -m "typ(scope): opis"` → `git push`
- Przed commitem: `npm run typecheck` i `npm run lint`

## Release

```bash
npm run release
git push --follow-tags
```

## Dependabot

Na GitHubie otwórz PR → zielony przycisk "Squash and merge". Tyle.
