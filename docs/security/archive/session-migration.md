# Migracja sesji: httpOnly cookie + session rotation

## Cel

Eliminacja `X-Auth-Token` z `localStorage` na rzecz httpOnly cookie z rotacją tokena.
Likwiduje to wektor XSS kradzieży tokena (localStorage jest dostępny przez JS).

## Obecny stan (przed migracją)

### Backend (`src/routes/auth.ts`)

- **Login (linia 47-53)**: Już ustawia httpOnly cookie:

    ```
    res.cookie('authToken', token, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
    ```

    ORAZ zwraca `{ token, user }` w body — frontend używa body, nie cookie.

- **requireAuth middleware (`src/middleware/auth.ts:83`)**:

    ```
    const token = req.headers['x-auth-token'] || req.cookies?.authToken;
    ```

    Obsługuje obie ścieżki.

- **Logout (`src/routes/auth.ts:152-163`)**:
  Czyści sesję z bazy i usuwa cookie. Nadal odczytuje token z headera.

- **Brak rotacji sesji**: Token nigdy nie jest odnawiany po utworzeniu.

### Frontend — localStorage

| Plik                                            | Użycie                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| `public/js/shared/auth.js`                      | `getAuthToken()`, `setAuthToken()`, `authHeaders()` z `X-Auth-Token`, `appLogout()` |
| `public/js/shared/dashboard.js`                 | `doLogin()` zapisuje do localStorage, `doLogout()` czyści                           |
| `public/js/shared/StorageService.js`            | Linia 40, 45 — odczyt tokena z localStorage, wysyłka jako header                    |
| `public/js/import-export/shared/featureFlag.js` | Linia 11 — manualne `X-Auth-Token`                                                  |

### Inne użycia localStorage (nie auth)

| Plik                                 | Użycie                                           | Status                        |
| ------------------------------------ | ------------------------------------------------ | ----------------------------- |
| `public/js/studnie/mlDualRanking.js` | `localStorage.getItem('wells_ai_influence')`     | Feature flag — nie zmieniać   |
| `public/js/sales/kartotekaInit.js`   | `localStorage.getItem('kartoteka-compact-mode')` | Preferencja UI — nie zmieniać |

### Model Prisma (`prisma/schema.prisma:388-392`)

```prisma
model sessions {
  token     String @id
  userId    String
  createdAt BigInt
}
```

Brak: `lastUsedAt`, `ipAddress`, `userAgent`.

## Plan migracji (C01)

### Krok 1: Rozszerzenie modelu `sessions`

Dodać kolumny:

- `lastUsedAt` — BigInt (timestamp ostatniego użycia)
- `ipAddress` — String? (opcjonalnie, do audytu)
- `userAgent` — String? (opcjonalnie, do audytu)

### Krok 2: Session rotation na backendzie

W `middleware/auth.ts`:

- Przy każdym udanym `requireAuth`:
    1. Utwórz nowy token (session rotation)
    2. Zapisz nową sesję z nowym tokenem, tym samym userId, nowym createdAt i lastUsedAt
    3. Usuń starą sesję (lub oznacz jako nieaktywną)
    4. Ustaw nowe httpOnly cookie z nowym tokenem
- Opcjonalnie: czyścić stare/zrotowane sesje (lub przez cron)

### Krok 3: Frontend — usunięcie localStorage dla auth

- `public/js/shared/auth.js`:
    - `getAuthToken()` → zwraca `null` (do usunięcia po migracji wszystkich zależności)
    - `setAuthToken()` → noop (do usunięcia)
    - `authHeaders()` → nie dodaje `X-Auth-Token`, tylko `credentials: 'include'`
    - `appLogout()` → nie czyści localStorage dla authToken

- `public/js/shared/dashboard.js`:
    - `DOMContentLoaded` — nie sprawdza localStorage, tylko od razu próbuje `fetch('/api/auth/me', { credentials: 'include' })`
    - `doLogin()` — nie zapisuje do localStorage
    - `doLogout()` — nie czyści localStorage

- `public/js/shared/StorageService.js`:
    - Usunąć odczyt z localStorage i wysyłkę `X-Auth-Token`

- `public/js/import-export/shared/featureFlag.js`:
    - Usunąć `X-Auth-Token` header

### Krok 4: Testy

- Zaktualizować `tests/authMiddleware.test.ts` — testować przez cookie, nie tylko header
- Dodać test rotacji sesji

### Krok 5: Weryfikacja

- `rg "localStorage\..*authToken" public/` → 0 matches
- `rg "X-Auth-Token" public/` → 0 matches (tylko komentarze dozwolone)

## Kolejność implementacji

1. Migracja Prisma (dodanie kolumn do `sessions`)
2. Session rotation w `middleware/auth.ts`
3. Frontend: `auth.js` (rdzeń auth)
4. Frontend: `dashboard.js` (login/logout flow)
5. Frontend: `StorageService.js`, `featureFlag.js` (pozostałe)
6. Testy
7. `rg` — weryfikacja 0 matches

## Ryzyka

- **Rotacja + race condition**: Jeśli dwa równoległe requesty używają tego samego tokena, drugi może dostać 401 (stary token usunięty). Rozwiązanie: okno tolerancji (przez ~1s akceptuj zarówno stary, jak i nowy token) lub lazy rotation (odświeżaj tylko jeśli token ma > X% wieku).
- **Zgodność wsteczna**: Stare sesje w bazie bez `lastUsedAt` — obsłużyć jako `null`.
