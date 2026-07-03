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

## Przyszłość

Docelowo: **routing + klasyfikacja + cache** żyją w Hermes (fork/PR). My
dostarczamy tylko manifest. To jest architektura dla dowolnego modelu,
nie specyficzna dla providera.
