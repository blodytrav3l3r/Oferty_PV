# Router -- CORE skill (ALWAYS LOADED, ~600 b)

# Meta-skill opisujący routing Hermes → skills.

#

# JEDYNE stałe rzeczy tutaj: reakcje na słowa-klucze. Szczegóły,

# koszty, warunki ładowania → konsultuj:

#

# .hermes/skills/_manifest.yaml

#

# Ten plik mówi Hermesowi CO reaguje, manifest mówi DLACZEGO.

## ALREADY LOADED

- `conventions-lite` (CORE, ~4 KB)
- Router (ten plik)
- AGENTS.md (root projektu, reguły always-on)

## Twarde reguły

1. **NIE ładuj pełnych SKILL.md preventive.** Ładuj tylko gdy detector z manifestu matchuje.
2. **Język**: dokumentacja/komentarze po polsku; identyfikatory po angielsku.
3. **Wersja SSoT = `VERSION`** w root projektu. `npm run version:check` przed push.
4. **SPA**: `app.html` jedyny entry. Moduły (studnie.html etc.) działają jako iframe.
5. **Cache loaded**: nie powtarzaj tego samego skilla w tym samym prompcie.

## Reakcja na słowa-klucze (pierwszy match)

| Fraza użytkownika                             | Akcja                                                 |
| --------------------------------------------- | ----------------------------------------------------- |
| `/graphify`, "knowledge graph", "graph query" | załaduj `graphify` (heavy, invoke)                    |
| "audyt", "audit", "codebase review"           | załaduj `codebase-audit` (heavy)                      |
| "code review", "review PR", "recenzja kodu"   | załaduj `requesting-code-review` (heavy)              |
| Błędy excel/paste/copy/TSV                    | załaduj `excel-debug`                                 |
| Praca w `well_configurator_backend/`          | załaduj `python-debugpy`                              |
| AI/telemetry/ML/dashboard komponent           | załaduj `oferty-pv-ai-telemetry`                      |
| Modyfikacje SPA/app.html/router/iframe        | załaduj `sp-a-conventions` (95 KB - planuj ostrożnie) |
| Plan mode (.hermes/plan-*.md istnieje)        | załaduj `plan-guardian`                               |
| Regresja, hard-to-repro bug                   | załaduj `systematic-debugging`                        |
| Złożone (>3 pliki) / nowy feature             | rozważ `multi-agent-coordination` + `plan`            |
| Refaktoring / cleanup po sesji                | załaduj `simplify-code`                               |
| Throwaway experiment                          | załaduj `spike`                                       |
| Pisanie testów / TDD                          | załaduj `test-driven-development`                     |
| Debug wydajności Node                         | załaduj `node-inspect-debugger`                       |

## Kiedy NIE ładuj niczego

- Prosty 1-2 plik-fix → tylko core (router + conventions-lite).
- Plan / design → tylko core + `plan` skill.
- Bez specyficznego triggera → tylko core.

## Debugging fallback

Gdy prompt nie pasuje do żadnego triggera, ale user mówi "napraw", "nie działa",
"pojawił się bug" → załaduj systematic-debugging. To jest generyczny playbook.

## Manifest SSoT

Konsultuj zawsze `.hermes/skills/_manifest.yaml`. Ten router to tylko
reguły routingu, nie definicja skilli.

(pełne reguły + koszty + decyzja: `_manifest.yaml`)
(architektura + dlaczego: `../../docs/ARCHITECTURE-SKILLS.md`)
