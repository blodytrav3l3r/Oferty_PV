# Version Guardian (agent + tooling)

Pliki dot. wersjonowania w Oferty_PV:

- **Agent**: `.hermes/agents/version-guardian.md` (prompt dla AI przy bump/CHANGELOG)
- **SSoT**: `VERSION` (root, np. `1.0.0`)
- **Mirror**: `package.json` → pole `"version"` musi być równe VERSION
- **Historia**: `CHANGELOG.md` (Keep a Changelog format, najnowsza na górze)

## Komendy

```bash
npm run version:check    # walidacja 3 plików (non-mutating)
npm run version:patch    # bump PATCH (1.0.0 → 1.0.1)
npm run version:minor    # bump MINOR (1.0.0 → 1.1.0)
npm run version:major    # bump MAJOR (1.0.0 → 2.0.0)
npm run version:set 2.1.5   # konkretna wersja
```

## Skrypty

- `scripts/check-version.mjs` — raportuje rozbieżności, exit 1 jeśli źle
- `scripts/bump-version.mjs` — mutuje `VERSION` + `package.json` (NIE CHANGELOG)

## Hook

`.husky/post-commit` — wywołuje `npm run version:check` po każdym commitcie
(non-blocking: sprawdza spójność, ale nie blokuje).

## Reguły SemVer (przypomnienie)

| Próg  | Kiedy                                            |
| ----- | ------------------------------------------------ |
| PATCH | bugfix, drobna poprawka, refactor bez nowego API |
| MINOR | nowa funkcjonalność wstecz kompatybilna          |
| MAJOR | łamanie kompatybilności, redesign, reset bazy    |
