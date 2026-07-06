# Skills Architecture — Oferty_PV

## Manifest jako SSoT

Identyfikator, kategoria, koszt, zależności, warunki załadowania — wszystko w
**`.hermes/skills/_manifest.yaml`** (YAML, schema_version: 1).

Konsumenci:
- **Hermes** — przez `.hermes/skills/_router.md`, który powołuje się na manifest
- **`scripts/skill-cli.mjs`** — CLI do budowy/walidacji statystyk manifestu
- **developer** — review w PR

## Kategorie

| Kategoria | Strategia ładowania |
|---|---|
| **core** | Auto-loaded na start sesji (router, conventions-lite) |
| **feature** | Loaded na żądanie gdy `task_class`, `component` lub `error_contains` matchuje |
| **heavy** | Loaded tylko na `invoke_only` (np. `/graphify`, "audyt") |

## Routing

Hermes automatycznie wczytuje opisy ze SKILL.md (frontmatter `description`).
Nasz `_router.md` mówi mu:
- zachowaj tylko 2-3 core skille zawsze-załadowane,
- reszta triggerowana słowami kluczowymi promtu.

## Koszty tokenów

Każdy skill ma `cost: ~N` (szacowane). Koszt obliczany deterministycznie:
`~N = ceil(bytes / 0.75)`.

`scripts/skill-cli.mjs stats` oblicza i raportuje:
- Łączny koszt gdyby załadować wszystko
- Koszt tylko core (baseline)
- Top-5 najdroższych skilli

## Cache załadowanych

Po stronie Hermesa (silnik). W runtime naszego profilu obowiązuje zasada:
jednorazowe załadowanie = referencja w kontekście, nie powtórne wstrzyknięcie.

W praktyce: `_router.md` mówi Hermesowi co już jest załadowane (CORE), więc
przy routing dla feature skills nie potrzeba powtarzać opisu core.

## Wersjonowanie

Manifest ma `schema_version: 1`. CLI waliduje zgodność przy każdym uruchomieniu.
Następna wersja schemy wymaga migratora (np. `migrate-v1-to-v2.mjs`).

## Pliki

| Plik | Rozmiar | Rola |
|---|---|---|
| `.hermes/skills/_manifest.yaml` | ~7 KB | SSoT definicji skilli |
| `.hermes/skills/_router.md` | ~1 KB | Ładowane zawsze; mówi gdzie szukać |
| `.hermes/skills/conventions-lite/SKILL.md` | ~4 KB | Skrót konwencji (CORE) |
| `.hermes/skills/graphify/` | 38 KB | skill graphify (heavy) |
| `docs/ARCHITECTURE-SKILLS.md` | — ten plik | Biała księga architektury |
| `scripts/skill-cli.mjs` | TBD | CLI: build-manifest, validate, stats |

## Filozofia

1. **Minimum prompt = maxyimum wydajności.** Mniej kontekstu = lepsze odpowiedzi mniejszych modeli.
2. **Manifest SSoT** zamiast wielu źródeł. Konsumenci czytają ten sam plik.
3. **Lazy load** przez sygnały (trigger) zamiast auto-load wszystkiego co istnieje.
4. **Specjalizacja** skilli przez `load_when` — nie wszystkie dane potrzebne od razu.
5. **Przenośność** — manifest jest agendą niezależną od Hermesa; przyszłe wersje silnika lub inne
   orkiestratory mogą korzystać z tej samej definicji.

## Wersja 2 — Context Planner (6-stage pipeline)

### Co się zmieniło od v1

| Obszar | v1 | v2 |
|---|---|---|
| `cost` | ręczny w YAML | computed przy `npm run skills:build-cost` (z SKILL.md) |
| Routing | `load_when` w manifeście | wyrzucone; w osobnym `_classifier.md` |
| Kategorie | core/feature/heavy | + domain, tool, workflow, experimental, deprecated |
| Wersja skilla | brak | `version` (semver) + opcjonalnie `checksum` |
| `tags` | stringi | `capabilities` (capability-resolver strategy) |
| `depends_on` | brak typu | `requires` / `optional` / `conflicts` / `before` / `after` |
| Score | brak | `utility` 0-100 + ratio `cost/utility` |
| Strategia doboru | keywords | 6-stage Planner: intent → capabilities → skills → deps → budget → Hermes |

### 6-stage Context Planner (`npm run skills:plan "<intent>"`)

1. **Intent Classifier** — regex/score match `_classifier.md` intents
2. **Capability Resolver** — inverse index z `manifest.skills[].capabilities`
3. **Skill Resolver** — wybór skili (`preferred_skills` + skoring po id/content match)
4. **Dependency Resolver** — transitive closure (`requires`, `optional`)
5. **Budget Optimizer** — drop najwyższy `cost/utility` ratio aż mieści się w `cap_total_cost_tokens`
6. **Output (Hermes-ready)** — gotowy plan z core auto-load + selected feature/heavy skills

### Pliki v2

| Plik | Rozmiar | Rola |
|---|---|---|
| `.hermes/skills/_manifest.yaml` (schema_version 2) | ~11 KB | SSoT: id, capabilities, utility, version, typed deps |
| `.hermes/skills/_router.md` | ~2.6 KB | CORE meta-skill — meta-load logic |
| `.hermes/skills/_classifier.md` (nowy) | ~5 KB | Routing: intent → load_when (POZA manifestem) |
| `.hermes/skills/conventions-lite/SKILL.md` | ~4 KB | CORE skrót konwencji |
| `scripts/skill-cli.mjs` (rozszerzony) | ~21 KB | CLI: build-cost, plan, capabilities, validate v2, cost, deps |
| `docs/ARCHITECTURE-SKILLS.md` (ten plik) | ~3 KB | Biała księga v2 |
| `_manifest.yaml --schema_version 1` | (legacy) | v1 zachowany w historii (commit `e8097ce`) |

### Przykład użycia Context Planner

```bash
npm run skills:plan "rozwiąż bug w excelu paste"
```

Output:
```
[Stage 1] Intent Classifier...
  matched intent (score=6): "rozwiąż bug w excelu (paste, copy, render, sticky cols)"
[Stage 2] Capability Resolver...
[Stage 3] Skill Resolver...
[Stage 4] Dependency Resolver...
  transitive closure: 6 skills
[Stage 5] Budget Optimizer...
  total cost: ~36000 t (cap: 100000 t)
  dropped for budget: (none)

[Stage 6] Output:
  ★ conventions-lite  cat=core     cost=  5439 t  util=95
  ★ router            cat=core     cost=  3399 t  util=100
  · excel-debug       cat=feature  cost=     0 t  util=87
  · systematic-debugging  cat=feature  cost=  0 t  util=80
  
  TOTAL: 6 skills, ~36000 tokens
```

## Przyszłość

Docelowo: **routing + klasyfikacja + cache + budget** żyją w Hermes (fork/PR). My
dostarczamy tylko manifest + classifier. To jest architektura dla dowolnego modelu,
nie specyficzna dla providera.
