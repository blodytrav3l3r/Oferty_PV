# ADR-016: Progi SLA per zespół / per user (fallback do globalnych)

**Status:** Zaakceptowany
**Data:** 2026-10-10
**Suplement do:** ADR-015 (eskalacja z `care_sla_config` globalnej)

## Kontekst

Progi SLA (`firstContactH`, `staleD`, `escalationH`) były wyłącznie globalne
(`care_sla_config.id = 'global'`). Zespoły o różnym rytmie pracy potrzebują
własnych progów; trigger rewizyty z ADR-015 („progi SLA per user / per zespół")
został osiągnięty.

## Decyzja

- Nowa tabela `care_sla_scopes (scopeType, scopeId)` — wiersze `('team', ownerId)`
  i `('user', userId)`; klucz `(scopeType, scopeId)`.
- Global zostaje w `care_sla_config` (zero migracji danych, kompatybilność).
- Efektywny próg: `team → (team, user.id)` dla scope=team (pro/admin);
  `mine → (user, user.id)` dla scope=mine; inaczej global.
  Zespół = właściciel-pro + jego subUsers (reguła ról jak w `resolveOwnerWhere`).
- Zapis: `PUT /sla {scopeType?: 'team' | 'user'}` — global tylko admin;
  `team` tylko pro/admin (własny `user.id`); `user` każdy dla siebie.
- ETag panelu (P2) obejmuje `MAX(updatedAt)` z nowej tabeli.
- Eskalacja i buckety SLA liczone z efektywnego progu w scope requeścia.

## Konsekwencje

- `GET /sla?scope=` zwraca też `source: global | team | user` (UI pokazuje, co edytuje).
- Migracja addytywna `IF NOT EXISTS` (jak care P1/P2); deploy na dev DB po backupie.
- Stare `PUT /sla` bez `scopeType` działa jak dawniej (global, admin).

## Triggery rewizyty

- Hierarchie głębsze niż pro → subUsers (wtedy drzewo zespołów, nie płaski owner).
- Progi per oferta / per klient (wtedy reguły, nie konfiguracja).

## Suplement 2026-10-11 (efektywny próg w powiadomieniach)

Eskalacja i progi naruszeń liczone z progu efektywnego w scope requeścia
(`getEffectiveSla` w `careService.ts:734-748`, sync w scope panelu).
Buckety zdrowia stałe, niezależne od progu (`src/utils/careStatus.ts:40-46`):
D+1/D+3/D+7/D+14. CASE w `notifCandidates` (`careService.ts:831-834`):
SLA_BREACH wygrywa z ESCALATION (pierwszy WHEN rozstrzyga).
