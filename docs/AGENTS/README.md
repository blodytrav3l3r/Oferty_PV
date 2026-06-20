# System Agentów — Oferty PV

Profesjonalne środowisko wieloagentowe do rozwoju aplikacji. Każdy agent ma dedykowaną rolę, zestaw narzędzi i reguły współpracy.

## Architektura

```
┌─────────────────────────────────────────────────┐
│                   H E R M E S                   │
│  (główny agent — Ty, rozmawiasz z userem)       │
├─────────────────────────────────────────────────┤
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐ │
│  │ PLANISTA │  │  KODER   │  │   REVIEWER     │ │
│  │ (skill)  │  │ (skill)  │  │   (skill)      │ │
│  │ task     │  │ impl.    │  │ code review    │ │
│  │ decompos.│  │ changes  │  │ lint+typecheck │ │
│  └──────────┘  └──────────┘  └────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │              ARCHITEKT                      │ │
│  │  (skill) — spójność, graphify, refactoring  │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Role

| Agent | Wywołanie | Hermes skills do załadowania | Narzędzia (toolsets) | Odpowiedzialność |
|-------|-----------|------------------------------|----------------------|------------------|
| **Planista** | `delegate_task(goal="zaplanuj...")` | `oferty-pv-planista` | terminal, file, search | Rozbija zadania, tworzy plan w `todo()`, proponuje architekturę |
| **Koder** | `delegate_task(goal="zaimplementuj...")` | `oferty-pv-koder, spike, node-inspect-debugger, systematic-debugging` | terminal, file, search | Pisze kod, testy, commituje. Przed implementacją używa spike do walidacji pomysłów. Debugowanie przez node-inspect-debugger gdy backend nie działa. |
| **Reviewer** | `delegate_task(goal="przejrzyj...")` | `oferty-pv-reviewer, requesting-code-review` | terminal, file | Code review (CRITICAL + INFORMATIONAL pass), typecheck, lint, security scan (requesting-code-review), bezpieczeństwo (XSS, SQL injection, auth, ownership) |
| **Architekt** | `delegate_task(goal="sprawdź spójność...")` | `oferty-pv-architekt, simplify-code, codebase-inspection` | terminal, file, search, graphify | Graphify update, spójność architektury, ADR, refactoring. simplify-code do cleanup po zmianach. codebase-inspection do audytu wielkości kodu. Security audit checklist, performance patterns, Prisma/SQLite patterns |

## Przepływ pracy

1. **User daje zadanie → Hermes (główny agent)** analizuje
2. **Planista** rozbija na podzadania → plan w `todo()`
3. **Koder** realizuje implementację (może być równolegle)
4. **Reviewer** sprawdza kod → typecheck, testy, lint
5. **Architekt** weryfikuje spójność → graphify update, ADR
6. **Hermes** raportuje wynik userowi + loguje do `docs/PROGRESS.md`

## Dokumentacja

- `docs/errors-known.md` — znane błędy z fixami
- `docs/CHANGELOG.md` — historia zmian
- `docs/PROGRESS.md` — dziennik postępu sesji
- `docs/ARCHITECTURE.md` — decyzje architektoniczne (ADR)
- `AGENTS.md` — dashboard stanu projektu + reguły operacyjne
