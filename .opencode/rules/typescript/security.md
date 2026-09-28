# TypeScript Security (zaadaptowano pod S.O.K.)

> Zrodlo: ECC typescript/security.md. Zgodne z AGENTS.md projektu i bazą bledow.

## Security Checklist

### Input Validation

- Walidacja danych wejsciowych przez `zod` v4
- Nigdy nie ufaj zewnetrznym danym (API, body, query params)
- Walidacja formatu dat ISO przed budowa filtrow (baza bledow #26)

### SQL Injection Prevention

- Zawsze parametryzowane zapytania Prisma (nigdy string interpolation w raw SQL)
- Nie buduj `where` z surowych stringow od uzytkownika

### XSS Prevention

- `escapeHtml` przy interpolacji do innerHTML (baza bledow #3)
- Pola edytowalne (nazwy produktow, numery zamowien) zawsze escapowane (baza bledow #24)
- W atrybutach HTML: `escapeHtmlAttr`/`escapeJsStr`, nigdy `escapeHtml` (baza bledow #39)
- Identyfikatory DOM nie pochodza z danych uzytkownika bez sanityzacji

## Anti-Patterns

| Anti-pattern                         | Dlaczego                            | Lepsze                              |
| ------------------------------------ | ----------------------------------- | ----------------------------------- |
| `any` w danych z API                 | Lata bezpieczenstwa typowania       | `unknown` + type guard / zod schema |
| Walidacja tylko czesci inputa        | Niepelne pokrycie                   | Pelna walidacja przez zod           |
| Wyciek stack trace w API             | Informacje o wewnetrznej strukturze | Mapowanie bledow do domenowych      |
| Ekspozycja encji Prisma w odpowiedzi | Wyciek wewnetrznych pol (hashes)    | Mapowanie do DTO                    |
| Interpolacja do SQL                  | SQL injection                       | Parametryzowane query               |

## Security Testing

- Przetestuj walidacje wejsciowa (zle dane, nieprawidlowe formaty)
- Testuj edge cases dat (nieprawidlowy format ISO)
- Uruchom agenta **security-reviewer** dla kodu autoryzacji i operacji na danych uzytkownika
