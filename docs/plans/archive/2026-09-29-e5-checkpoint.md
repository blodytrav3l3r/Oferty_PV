# E5 + E5.5 checkpoint — walidacja API + security gate (zero FAIL)

## E5 fixy

- `PUT /pricelist-versions/:id`: Zod kształtu (400 INVALID_BODY), `:id` jak clone-draft
  (400 INVALID_ID); domena w serwisie bez dubla (422/404). DELETE tak samo.
- `GET /audit/*`: allowlista 8 entityType z literałów kodu → 400 INVALID_ENTITY_TYPE przed DB.

## E5.5 gate (tabela)

- Auth/role na 5 ścieżkach + audit: PASS (401/403/400 zgodnie z kontraktem).
- IDOR clients/shares: PASS (wspólna baza celowa, owner z DB; revoke owner-only w tx).
- Leakage: PASS (selektywne pola, generyczne errory, zero wag ML).
- AI batch kontrakt+auth: PASS (401/400/422/503, brak leaku).
- Granice E2/E5: zero 500. Headery/CSP bez zmian.

## Bramy (FACT)

- Nowe: validation 9/9, auditLimit +11, e55gate 22/22 (razem 43 z audytem).
- `test:quick:lite`: 370 suit / 3965 PASS, 5 skip. `typecheck`, `lint`, `version:check` — GREEN.

## Decyzja bramki

E5/E5.5: SUCCESS. STOP — E6 (PR gate CI) wymaga GO.
