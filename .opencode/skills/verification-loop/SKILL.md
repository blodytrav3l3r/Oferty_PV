---
name: verification-loop
description: Verification system dla sesji opencode w projekcie S.O.K. Komendy znormalizowane do pakietu skryptow projektu.
metadata:
    origin: ECC (zaadaptowano pod S.O.K.)
---

# Verification Loop Skill

System weryfikacji zmian przed uznaniem pracy za zakonczona.

## When to Use

Uzyj tego skillu:

- Po zakonczeniu funkcji lub istotnej zmiany kodu
- Przed commitem
- Po refaktoryzacji
- Gdy chcesz upewnic sie, ze quality gates przechodza

## Verification Phases (komendy S.O.K.)

### Faza 1: Type Check

```bash
npm run typecheck       # backend TS
npm run typecheck:frontend
```

Jesli fail - STOP i napraw przed kontynuacja.

### Faza 2: Lint

```bash
npm run lint            # backend
npm run lint:frontend   # public/js
```

### Faza 3: Testy

```bash
npm run test:quick      # szybkie testy dymne (bez pokrycia)
npm test                # pelne testy z pokryciem
npm run test:alignment  # regresja Playwright - wyrównanie kolumn Excel
```

Raport:

- Razem testow: X
- Przeszlo: X
- Nie przeszlo: X

### Faza 4: Format

```bash
npm run format
```

### Faza 5: Wersjonowanie

```bash
npm run version:check   # OBOWIAZKOWE przed kazdym commitem/pushem
npm run encoding:check  # integralnosc kodowania UTF-8
```

### Faza 6: Pełna walidacja

```bash
npm run validate        # typecheck + lint + appname + testy dymne
```

## Output Format

Po wszystkich fazach wyprodukuj raport weryfikacji:

```
VERIFICATION REPORT
==================

Types:      [PASS/FAIL] (X errors)
Lint:       [PASS/FAIL] (X warnings)
Tests:      [PASS/FAIL] (X/Y passed)
Format:     [PASS/FAIL]
Version:    [PASS/FAIL]
Encoding:   [PASS/FAIL]

Overall:    [READY/NOT READY] for commit

Issues to Fix:
1. ...
2. ...
```

## Checkpoint Mode

W dlugich sesjach uruchamiaj weryfikacje po kazdej wiekszej zmianie:

- Po zakonczeniu kazdej funkcji
- Po skonczeniu komponentu
- Przed przejsciem do nastepnego zadania
