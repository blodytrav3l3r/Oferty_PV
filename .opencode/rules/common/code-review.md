# Code Review Standards (zaadaptowano pod S.O.K.)

> Zrodlo: ECC common/code-review.md. Limity rozmiaru i wymogi testowe zgodne z AGENTS.md
> projektu (limity w sekcji 2, testy: `npm run test:quick` / `validate`).

## Purpose

Code review zapewnia jakosc, bezpieczenstwo i utrzymywalnosc kodu przed mergem/commitem.

## When to Review

**OBOWIAZKOWE triggery review:**

- Po napisaniu lub zmodyfikowaniu kodu
- Przed commitem na wspolnych galeziach
- Gdy zmieniany jest kod wazny dla bezpieczenstwa (auth, dane uzytkownikow)
- Gdy wprowadzane sa zmiany architektoniczne

**Przed review:**

- Wszystkie automatyczne checki przechodza (CI/CD)
- Konflikty rozwiazane

## Review Checklist

Przed uznaniem kodu za kompletny:

- [ ] Kod czytelny i dobrze nazwany (czasownik+rzeczownik dla funkcji)
- [ ] Funkcje w rozmiarze ~100-150 linii (AGENTS.md)
- [ ] Pliki w rozmiarze ~1000-1500 linii (AGENTS.md)
- [ ] Maksymalnie 3 poziomy zagniezdzenia (AGENTS.md)
- [ ] Bledy obslugiwane jawnie (bez silent fail)
- [ ] Brak twardo zakodowanych sekretow
- [ ] Brak `console.log` w kodzie produkcyjnym (wykrywa tez husky)
- [ ] Testy dla nowej funkcjonalnosci (zgodnie z `npm run test:quick` / `validate`)
- [ ] `escapeHtml` przy interpolacji do innerHTML

## Security Review Triggers

**STOP i uzyj agenta security-reviewer, gdy:**

- Kod uwierzytelniania/autoryzacji
- Obsluga danych wejsciowych uzytkownika
- Zapytania do bazy danych
- Operacje na plikach
- Zewnetrzne wywolania API
- Kod finansowy / cenowy (oferty, kalkulacje!)

## Review Severity Levels

| Poziom   | Znaczenie                                         | Akcja                             |
| -------- | ------------------------------------------------- | --------------------------------- |
| CRITICAL | Podatnosc bezpieczenstwa lub ryzyko utraty danych | **BLOCK** - napraw przed mergem   |
| HIGH     | Bug lub istotny problem jakosci                   | **WARN** - powinno byc naprawione |
| MEDIUM   | Problem utrzymywalnosci                           | **INFO** - rozwaz naprawe         |
| LOW      | Styl lub drobna sugestia                          | **NOTE** - opcjonalnie            |

## Review Workflow

```
1. `git diff` aby zrozumiec zmiany
2. Check security checklist najpierw
3. Review code quality checklist
4. Kontrola dowodowa (Source of Truth Protocol): CLAIM ma EVIDENCE (plik:linia,
   test/runtime)? HYPOTHESIS nie przedstawiona jako FACT? Test regresyjny to
   RED→GREEN, nie zielony od poczatku?
5. Uruchom istotne testy
6. Uzyj odpowiedniego agenta do szczegolowego review
```

## Approval Criteria

- **Approve**: brak CRITICAL i HIGH issues
- **Warning**: tylko HIGH issues (merge z ostroznoscia)
- **Block**: znaleziono CRITICAL issues

## Integration with Other Rules

Ta regula wspolpracuje z:

- [testing.md](testing.md) - wymogi testowe
- [security.md](security.md) - security checklist
- [git-workflow.md](git-workflow.md) - standardy commitow
