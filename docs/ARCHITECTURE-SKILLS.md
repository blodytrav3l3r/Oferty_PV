# Skills Architecture — Oferty_PV

## Manifest jako SSoT

Identyfikator, kategoria, koszt, zależności, warunki załadowania — wszystko w
**`.hermes/skills/_manifest.yaml`** (YAML, schema_version: 3).

Konsumenci:

- **Hermes** — przez `.hermes/skills/_router.md`, który powołuje się na manifest
- **`scripts/skill-cli.mjs`** — CLI do budowy/walidacji statystyk manifestu
- **developer** — review w PR

## Kategorie

| Kategoria   | Strategia ładowania                                                           |
| ----------- | ----------------------------------------------------------------------------- |
| **core**    | Auto-loaded na start sesji (router, conventions-lite)                         |
| **feature** | Loaded na żądanie gdy `task_class`, `component` lub `error_contains` matchuje |
| **heavy**   | Loaded tylko na `invoke_only` (np. "audyt")                                   |

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

Manifest ma `schema_version: 3`. CLI waliduje zgodność przy każdym uruchomieniu.
Poprzednia wersja schemy (v2) jest zachowana jako `.hermes/skills/_manifest.v2.yaml.bak`;
nie istnieje osobny skrypt migratora — migracja schemy odbywa się przez aktualizację
manifestu i `npm run skills:validate`.

## Pliki

| Plik                                       | Rozmiar | Rola                               |
| ------------------------------------------ | ------- | ---------------------------------- |
| `.hermes/skills/_manifest.yaml`            | ~15 KB  | SSoT definicji skilli              |
| `.hermes/skills/_router.md`                | ~2.5 KB | Ładowane zawsze; mówi gdzie szukać |
| `.hermes/skills/_classifier.md`            | ~4.3 KB | Routing: intent → load_when        |
| `.hermes/skills/_provider-model.yaml`      | ~3.8 KB | Mapa capability → implementacje    |
| `.hermes/skills/conventions-lite/SKILL.md` | ~4 KB   | Skrót konwencji (CORE)             |
| `scripts/skill-cli.mjs`                    | ~31 KB  | CLI skilli (13 subkomend)          |
| `docs/ARCHITECTURE-SKILLS.md`              | ~7 KB   | Ten plik — biała księga            |

## Filozofia

1. **Minimum prompt = maxyimum wydajności.** Mniej kontekstu = lepsze odpowiedzi mniejszych modeli.
2. **Manifest SSoT** zamiast wielu źródeł. Konsumenci czytają ten sam plik.
3. **Lazy load** przez sygnały (trigger) zamiast auto-load wszystkiego co istnieje.
4. **Specjalizacja** skilli przez `load_when` — nie wszystkie dane potrzebne od razu.
5. **Przenośność** — manifest jest agendą niezależną od Hermesa; przyszłe wersje silnika lub inne
   orkiestratory mogą korzystać z tej samej definicji.

## Wersja 2 — Context Planner (6-stage pipeline)

### Co się zmieniło od v1

| Obszar           | v1                       | v2                                                                       |
| ---------------- | ------------------------ | ------------------------------------------------------------------------ |
| `cost`           | ręczny w YAML            | computed przy `npm run skills:build-cost` (z SKILL.md)                   |
| Routing          | `load_when` w manifeście | wyrzucone; w osobnym `_classifier.md`                                    |
| Kategorie        | core/feature/heavy       | + domain, tool, workflow, experimental, deprecated                       |
| Wersja skilla    | brak                     | `version` (semver) + opcjonalnie `checksum`                              |
| `tags`           | stringi                  | `capabilities` (capability-resolver strategy)                            |
| `depends_on`     | brak typu                | `requires` / `optional` / `conflicts` / `before` / `after`               |
| Score            | brak                     | `utility` 0-100 + ratio `cost/utility`                                   |
| Strategia doboru | keywords                 | 6-stage Planner: intent → capabilities → skills → deps → budget → Hermes |

### 6-stage Context Planner (`npm run skills:plan "<intent>"`)

1. **Intent Classifier** — regex/score match `_classifier.md` intents
2. **Capability Resolver** — inverse index z `manifest.skills[].capabilities`
3. **Skill Resolver** — wybór skili (`preferred_skills` + skoring po id/content match)
4. **Dependency Resolver** — transitive closure (`requires`, `optional`)
5. **Budget Optimizer** — drop najwyższy `cost/utility` ratio aż mieści się w `cap_total_cost_tokens`
6. **Output (Hermes-ready)** — gotowy plan z core auto-load + selected feature/heavy skills

### Pliki v2

| Plik                                               | Rozmiar | Rola                                                                                                                                                           |
| -------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.hermes/skills/_manifest.yaml` (schema_version 3) | ~15 KB  | SSoT: id, capabilities, utility, version, typed deps, tier                                                                                                     |
| `.hermes/skills/_manifest.v2.yaml.bak` (legacy)    | ~11 KB  | Poprzednia schema v2 (backup)                                                                                                                                  |
| `.hermes/skills/_router.md`                        | ~2.5 KB | CORE meta-skill — meta-load logic                                                                                                                              |
| `.hermes/skills/_classifier.md`                    | ~4.3 KB | Routing: intent → load_when (POZA manifestem)                                                                                                                  |
| `.hermes/skills/_provider-model.yaml`              | ~3.8 KB | Capability → implementacje (Provider Pattern)                                                                                                                  |
| `.hermes/skills/conventions-lite/SKILL.md`         | ~4 KB   | CORE skrót konwencji                                                                                                                                           |
| `scripts/skill-cli.mjs` (rozszerzony)              | ~31 KB  | CLI: 13 subkomend (build-cost, plan, capabilities, validate, cost, deps, stats, provider-resolve, feedback-record/show, utility-recalc, build-manifest, build) |
| `docs/ARCHITECTURE-SKILLS.md` (ten plik)           | ~7 KB   | Biała księga v2/v3                                                                                                                                             |

### Wersja 3 — Provider Pattern

v3 (aktualna schema manifestu) zmienia model routingu capability:

- **Capability = service, nie skill.** Skille są implementacjami (providers) capability.
- `providers:` — mapa `capability → implementations[]` z rankingiem po `tier`.
- `tier:` — `standard` / `pro` / `lite` (alternatywne implementacje tej samej capability).
- `replaces:` — skill wskazuje, które wycofane skille zastępuje.
- `utility_state:` — dynamiczne utility (`base + history + success + recency`).
- `soft_requires:` — zależność opcjonalna, pomijalna przy małym budżecie.
- `confidence` / `latency_ms` — kryteria multicriteria dla budget optimizer
  (`budget_weights`: cost 0.5, utility 0.3, confidence 0.15, latency 0.05).
- `checksum` / `last_updated` — invalidacja cache.

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
