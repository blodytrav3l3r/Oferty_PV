# Kontrakt API P1-3 (decyzja + test, 2026-09-29)

## Faktura

- Adnotacje `@openapi` ma **1 plik** (`src/routes/healthPdf.ts`) — `/api/docs.json` to szkielet, nie kontrakt. Pełne opisywanie ~100 endpointów JSDoc = duży diff o wartości dokumentacyjnej, nie runtime. Odrzucono (YAGNI).
- Realny kontrakt egzekwują: Zod na wejściu + testy (`offersContract`, `apiValidation`, `validation`, security/*).

## Decyzja (hierarchia źródeł prawdy)

```text
business invariant → implementation + Zod → contract tests → OpenAPI/docs
```

OpenAPI nie staje się źródłem prawdy. CI egzekwuje kształt błędów i obecność docs, nie pełny schemat (unikamy egzekwowania nieaktualnej dokumentacji).

## Test

`tests/security/apiErrorContract.test.ts` — każdy błąd API to `{ error: string }` (401 anon na GET/POST, kontrola `/health` bez `error`, `/api/docs.json` szkielet 3.x). RED w trakcie: zła ścieżka `/api/offers` → 404 (mount to `/api/offers-rury`) — poprawiono test, nie kod.
