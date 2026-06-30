# Zasady kontrybucji — WITROS Oferty PV

Dziękujemy za zainteresowanie rozwojem projektu WITROS Oferty PV! Poniżej znajdziesz zasady, którymi kierujemy się przy przyjmowaniu zmian.

---

## 1. Branch strategy

Stosujemy uproszczony model **Git Flow**:

| Gałąź       | Opis                                                                       |
| ----------- | -------------------------------------------------------------------------- |
| `main`      | Kod produkcyjny. Tylko z pull requestów zatwierdzonych przez code review.  |
| `develop`   | Główna gałąź rozwojowa. Łączy w sobie feature/fix przed release.           |
| `feature/*` | Nowe funkcjonalności. Twórz z `develop`, merguj do `develop`.              |
| `fix/*`     | Poprawki błędów. Twórz z `develop`, merguj do `develop`.                   |
| `hotfix/*`  | Pilne poprawki na produkcję. Twórz z `main`, merguj do `main` i `develop`. |
| `release/*` | Przygotowanie wydania. Twórz z `develop`, merguj do `main` i `develop`.    |

### Przykład

```bash
git checkout develop
git checkout -b feature/nazwa-funkcjonalnosci
# ... praca nad kodem ...
git commit -m "feat(scope): opis zmiany"
git push origin feature/nazwa-funkcjonalnosci
# Otwórz Pull Request do develop
```

---

## 2. Conventional Commits

W projekcie wymagamy **Conventional Commits** — format commitów zgodny ze specyfikacją [conventionalcommits.org](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <opis>
```

Dozwolone **type**:

| Typ        | Znaczenie                                     |
| ---------- | --------------------------------------------- |
| `feat`     | Nowa funkcjonalność (→ minor w wersjonowaniu) |
| `fix`      | Poprawka błędu (→ patch w wersjonowaniu)      |
| `refactor` | Zmiana struktury kodu bez zmiany działania    |
| `chore`    | Zmiany narzędziowe, zależności, konfiguracja  |
| `docs`     | Zmiany w dokumentacji                         |
| `perf`     | Optymalizacja wydajności                      |
| `test`     | Dodanie lub zmiana testów                     |
| `style`    | Formatowanie kodu (spacje, przecinki, itp.)   |

Dozwolone **scope** (kontekst zmiany):

`rury`, `studnie`, `offers`, `orders`, `prisma`, `auth`, `ui`, `api`, `seed`, `deploy`, `clients`, `audit`, `settings`, `preco`, `telemetry`, `deps`, `docs`, `ci`, `config`, `test`, `docker`, `security`, `chore`, `release`

### Przykłady

```
feat(auth): dodanie zmiany hasła przez użytkownika
fix(offers): naprawa kalkulacji kosztów transportu dla studni
docs(api): aktualizacja dokumentacji endpointu /api/clients
chore(deps): aktualizacja @prisma/client do wersji 6.1.0
test(orders): dodanie testów dla numeracji zamówień
```

---

## 3. Pull Requesty

### Proces

1. Utwórz gałąź zgodnie z branch strategy (np. `feature/dodanie-eksportu-csv`).
2. Wprowadź zmiany z zachowaniem **Conventional Commits**.
3. Upewnij się, że kod przechodzi walidację:
    ```bash
    npm run validate
    ```
    Sprawdza: typecheck (backend + frontend), lint, testy.
4. **Pull Request powinien mieć:**
    - Nazwę opisującą zmianę (może być w języku polskim lub angielskim)
    - Opis: co zostało zmienione, dlaczego i jak testować
    - Link do issue (jeśli dotyczy)
5. Oznacz PR etykietą: `feature`, `bugfix`, `hotfix`, `docs`, `chore`.
6. Przypisz co najmniej jednego recenzenta.
7. Po pozytywnym code review i przejściu CI — merge.

### Wymagania PR

- [ ] Kod przechodzi `npm run validate`
- [ ] Nowa funkcjonalność ma testy (jednostkowe i/lub integracyjne)
- [ ] Zmiana w API jest udokumentowana w Swagger
- [ ] Zmiana w bazie danych ma migrację Prisma
- [ ] Commity są zgodne z Conventional Commits
- [ ] PR zawiera opis zmian

---

## 4. Code Review

Każdy PR wymaga code review przed mergem. Recenzent sprawdza:

- Poprawność logiczną i brak błędów
- Zgodność z architekturą projektu
- Jakość kodu (czytelność, nazewnictwo, DRY)
- Pokrycie testami
- Bezpieczeństwo (walidacja danych, autoryzacja)
- Wydajność (szczególnie zapytania do bazy)

### Wskazówki

- Bądź konstruktywny w recenzji — pisz **co** i **dlaczego** warto zmienić.
- Używaj GitHub sugerowanych zmian (suggested changes).
- Drobne zmiany (formatowanie, literówki) możesz zatwierdzić bez komentarza.
- Większe zmiany architektoniczne warto przedyskutować na Discordzie lub w issue.

---

## 5. Wersjonowanie

Projekt używa **Semantic Versioning** (SemVer 2.0.0):

- `feat` → increment wersji **minor** (x.y+1.0)
- `fix` → increment wersji **patch** (x.y.z+1)
- `BREAKING CHANGE` → increment wersji **major** (x+1.0.0)

Szczegóły: [VERSIONING.md](VERSIONING.md)

---

## 6. Uruchomienie lokalne

```bash
git clone https://github.com/blodytrav3l3r/Oferty_PV.git
cd Oferty_PV
npm install
cp .env.example .env
# edytuj .env — ustaw DEFAULT_ADMIN_PASSWORD
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

Więcej szczegółów w [README.md](README.md).

---

## 7. Raportowanie błędów

Błędy zgłaszaj przez GitHub Issues. W opisie podaj:

- Wersję projektu (z `package.json`)
- System operacyjny i przeglądarkę
- Kroki do reprodukcji
- Oczekiwane i rzeczywiste zachowanie
- Zrzuty ekranu (jeśli dotyczy)

---

## 8. Kodeks postępowania

- Bądź szanowny i otwarty na opinie innych.
- Krytykuj kod, nie osobę.
- Pomagaj nowym kontrybutorom.
- Dąż do wspólnego celu — lepszego oprogramowania.

---

_Ostatnia aktualizacja: 2026-06-30_
