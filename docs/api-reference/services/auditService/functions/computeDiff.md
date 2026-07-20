[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [services/auditService](../README.md) / computeDiff

# Function: computeDiff()

> **computeDiff**(`oldObj`, `newObj`): \{ `changed`: `Record`\<`string`, `unknown`\>; `old`: `Record`\<`string`, `unknown`\>; \} \| `null`

Defined in: [src/services/auditService.ts:20](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/auditService.ts#L20)

Oblicza płytką różnicę między dwoma obiektami (tylko klucze pierwszego poziomu).
Zwraca { changed, old } tylko ze zmodyfikowanymi polami lub null, jeśli są identyczne.

## Parameters

### oldObj

`Record`\<`string`, `unknown`\> \| `null`

### newObj

`Record`\<`string`, `unknown`\> \| `null`

## Returns

\{ `changed`: `Record`\<`string`, `unknown`\>; `old`: `Record`\<`string`, `unknown`\>; \} \| `null`
