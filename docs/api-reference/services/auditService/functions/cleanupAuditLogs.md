[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [services/auditService](../README.md) / cleanupAuditLogs

# Function: cleanupAuditLogs()

> **cleanupAuditLogs**(): `Promise`\<`void`\>

Defined in: [src/services/auditService.ts:139](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/auditService.ts#L139)

Usuwa logi audytu starsze niż MAX_AUDIT_AGE_DAYS.
Powinno być wywołane raz przy starcie aplikacji.

## Returns

`Promise`\<`void`\>
