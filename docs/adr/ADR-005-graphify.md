# ADR-005: Graphify do inteligencji kodu

**Status:** Zaakceptowany  
**Data:** 2026-06-20  
**Autor:** Hermes Agent  

## Kontekst

Projekt ma 48+ plików TypeScript (backend) i 30+ plików JS (frontend, ~37k linii). 
Znajdowanie funkcji, zależności i kodu bez narzędzi AI jest czasochłonne. 
Grep/cat zużywają dużo tokenów przy pracy z AI agentami.

## Decyzja

**Graphify** jako system inteligencji kodu oparty na grafie AST.

## Uzasadnienie

1. **16k nodów, 25k krawędzi** — pełny graf zależności całej bazy kodu.
2. **Zamiast grep/read** — `graphify query "gdzie jest funkcja licząca cenę"` → JSON z plikiem:linią.
3. **Relacje** — `graphify path "server.ts" "pricelistService.ts"` → ścieżka zależności przez cały call graph.
4. **AST-only** — aktualizacja `graphify update .` nie wymaga API LLM, tylko lokalne parsowanie AST.
5. **Cache'owanie** — `scripts/graphify-query.ps1` cache'uje wyniki, oszczędza tokeny.
6. **Zgodność z AGENTS.md** — wymuszone przez reguły projektu jako pierwsze źródło wiedzy.

## Konsekwencje

- **Obowiązkowe użycie** — `graphify query` przed `grep`/`read_file` w workflow.
- **Aktualizacja po każdej zmianie** — `graphify update .` lub `npm run graphify:ast-update` po modyfikacji kodu.
- **CI integration** — `graphify build .` w pipeline.
- **Zależność od Node** — Graphify działa jako npm package.

## Przykłady użycia

```bash
# Znajdź funkcję
python scripts/graphify_query.py "funkcja przeliczająca cenę studni"

# Ścieżka zależności
graphify path "server.ts" "prismaClient.ts"

# Wyjaśnienie konceptu
graphify explain "magazynWL vs magazynKLB"
```

## Alternatywy odrzucone

| Alternatywa | Powód odrzucenia |
|------------|------------------|
| grep/rg | Brak zrozumienia struktury kodu (tylko tekst), dużo wyników, tokenochłonne |
| ctags/cscope | Nieaktualizowane dynamicznie, brak interfejsu query |
| GitHub Copilot Search | Wymaga GitHub, nie działa na AST offline |
