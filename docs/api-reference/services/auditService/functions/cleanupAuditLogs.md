[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [services/auditService](../README.md) / cleanupAuditLogs

# Function: cleanupAuditLogs()

> **cleanupAuditLogs**(): `Promise`\<`void`>\>

Defined in: [src/services/auditService.ts:139](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/auditService.ts#L139)

Usuwa logi audytu starsze niż MAX_AUDIT_AGE_DAYS.
Powinno być wywołane raz przy starcie aplikacji.

## Returns

`Promise`\<`void`\>
