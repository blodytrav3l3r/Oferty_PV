# Changelog

Wszystkie znaczące zmiany w projekcie będą dokumentowane w tym pliku.

Format oparty na [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Dodane

- Health check endpoint (`GET /health`)
- Compression middleware dla lepszej wydajności
- Security headers middleware
- CSRF protection
- Walidacja danych wejściowych (Zod)
- System backupu bazy danych
- Docker i Docker Compose konfiguracja
- GitHub Actions CI/CD pipeline
- Jest test framework z testami jednostkowymi
- ESLint i Prettier konfiguracja
- TypeScript konfiguracja
- Paginacja API
- Password policy (min. 8 znaków, uppercase, lowercase, cyfry)
- HttpOnly cookies dla sesji
- HTTPS redirect w production

### Zmienione

- Ulepszone cookie security (sameSite: 'strict', secure w production)
- Dodane security headers (X-Content-Type-Options, X-Frame-Options, itp.)
- Ulepszona struktura projektu

### Naprawione

- Poprawki w middleware auth
- Obsługa błędów w endpointach

## [1.0.0] - 2024-01-01

### Dodane

- Initial release
- System autentykacji z rolami (admin, pro, user)
- Zarządzanie ofertami rur i studni
- Kartoteka produktów
- Zlecenia produkcyjne
- Audit logs z debounce
- Eksport ofert do HTML/PDF
- Baza danych SQLite z WAL mode
- Migracje bazy danych
- Rate limiting na logowaniu
- Historia zmian ofert (do 5 wersji)
- Recykling numerów zleceń produkcyjnych
