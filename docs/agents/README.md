# Przewodniki dla agentów

Root [`AGENTS.md`](../../AGENTS.md) określa wspólne zasady, źródła prawdy i bramy jakości. Użyj poniższych przewodników tylko dla obszaru, którego dotyczy zadanie.

| Temat                                  | Przewodnik                                                       |
| -------------------------------------- | ---------------------------------------------------------------- |
| Backend, Express, Prisma               | [backend.md](backend.md)                                         |
| Frontend, Studnie, Rury, UI            | [frontend.md](frontend.md)                                       |
| Baza danych, migracje, backup, cenniki | [database.md](database.md)                                       |
| Bezpieczeństwo                         | [security.md](security.md)                                       |
| Testy i walidacja                      | [testing.md](testing.md)                                         |
| Wersje, release, plany                 | [release.md](release.md)                                         |
| Komendy i kodowanie                    | [commands.md](commands.md)                                       |
| Evidence-first i audyty                | [evidence.md](evidence.md)                                       |
| Metryki repozytorium                   | [metrics.md](metrics.md) — datowana migawka, nie bieżący licznik |

## Kolejność stosowania

1. `AGENTS.md` i [`AUTONOMY_CONTRACT.md`](../AUTONOMY_CONTRACT.md) mają pierwszeństwo.
2. Ten indeks kieruje do właściwego przewodnika domenowego.
3. `docs/` opisuje stan repozytorium; jeśli dokument i kod, testy albo konfiguracja się różnią, zweryfikuj stan w źródle i zgłoś niezgodność.

Nie kopiuj bramek jakości do kolejnych dokumentów. Ich źródłem prawdy jest `AGENTS.md` oraz `docs/agents/testing.md`.
