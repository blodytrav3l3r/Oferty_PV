---
description: Zapytaj graf wiedzy Graphify o kodzie (skoncentrowane pytanie)
---
Użycie: `graphify query "<pytanie o architekturę, zależności lub kod>"`

Zwraca scope'owany subgraph — znacznie mniejszy i trafniejszy niż grep lub GRAPH_REPORT.md.

Automatyczne użycie (agent):
- Przed odpowiedzią na pytania o architekturę / zależności / nieznane funkcje automatycznie sprawdzam graphify
- `graphify query` > `GRAPH_REPORT.md` > `grep` — graphify daje scope'owany kontekst przed grepem
