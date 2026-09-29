# Audit guarantee matrix P1-4 (decyzja, 2026-09-29)

Stan: `logAudit(..., db = prisma)` wspiera wpis w tx biznesowej, ale ŻADEN caller nie przekazuje klienta tx — wszystkie wywołania to fire-and-forget poza transakcją; błąd → `recordAuditFailure()` + strukturalny log, nigdy throw (I-012). Testy: `tests/security/audit.test.ts`, `auditAtomicity.test.ts`.

## Decyzja: I-012 ZOSTAJE (best effort)

Uzasadnienie: S.O.K. to system biznesowy single-node, nie compliance-ledger. Gwarantowany audyt (failure blocks) zamieniałby każdą awarię `audit_logs` w odmowę sprzedaży — gorszy availability bez wymogu regulacyjnego. Zmiana tylko za jawnym wymogiem compliance.

## Macierz (stan → polityka)

| Operacja                                  | Audit                          | Transactional      | Failure blocks | Uwaga                                          |
| ----------------------------------------- | ------------------------------ | ------------------ | -------------- | ---------------------------------------------- |
| login/logout                              | NIE                            | —                  | —              | sesje w DB, nie audit_logs                     |
| offer create/update/delete (rury+studnie) | TAK (snapshot/diff+debounce)   | NIE (osobny zapis) | NIE            | ubytek widoczny w `audit.failures`             |
| order create/update/delete                | TAK                            | NIE                | NIE            | jak wyżej                                      |
| duplicate/export (PDF/DOCX/XLSX)          | create TAK / export NIE        | —                  | —              | eksport nie jest mutacją stanu                 |
| pricing (preco/overrides/versions)        | TAK (versions) / NIE (podgląd) | NIE                | NIE            | mutacje cen logowane                           |
| shares create/revoke                      | TAK                            | NIE                | NIE            |                                                |
| locks acquire/release                     | NIE                            | —                  | —              | TTL 180 s, nie audytowane                      |
| ML train/activate/rollback/approve        | TAK                            | NIE                | NIE            | `ai_model` + `settings`                        |
| admin users/featureFlags                  | TAK (featureFlags) / users NIE | NIE                | NIE            | luka: mutacje users bez wpisu — kandydat na P2 |

## Następne (warunkowe, NIE w tym planie)

- Wpisy `users` create/update/delete → `logAudit` (mały diff, gdy priorytet).
- Opcja tx-client dla pricing/orders — tylko z decyzją compliance (ryzyko: długie tx, locki SQLite).
- **Zakaz:** cichej zmiany I-012 przy okazji innych batchy.
