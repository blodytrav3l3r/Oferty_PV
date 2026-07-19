[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [services/auditService](../README.md) / logAudit

# Function: logAudit()

> **logAudit**(`entityType`, `entityId`, `userId`, `action`, `newData`, `oldData?`): `Promise`\<`void`>\>

Defined in: [src/services/auditService.ts:58](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/auditService.ts#L58)

Loguje wpis audytu dla zmian encji.
Dla akcji 'update': oblicza różnicę (diff) i stosuje debouncing (pomija zmiany w ciągu 30s).
Dla akcji 'create'/'delete': przechowuje pełną migawkę danych.

## Parameters

### entityType

`string`

### entityId

`string`

### userId

`string`

### action

`string`

### newData

`Record`\<`string`, `unknown`\> \| `null`

### oldData?

`Record`\<`string`, `unknown`\> \| `null`

## Returns

`Promise`\<`void`\>
