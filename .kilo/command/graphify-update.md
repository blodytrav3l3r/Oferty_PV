---
description: Zaktualizuj graf wiedzy Graphify po zmianach w kodzie
---
Zaktualizuj graf wiedzy Graphify (AST-only, bez kosztów API):
`npm run graphify:ast-update`

Automatyzacja:
- **post-commit hook**: uruchamia `graphify:ast-update` po każdym commicie
- **Agent (ja)**: uruchamiam to automatycznie po każdej zmianie kodu
- **Zero kosztów API**: tylko AST, bez LLM

Potwierdź że operacja się powiodła.
