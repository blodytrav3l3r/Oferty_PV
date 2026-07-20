[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [utils/ownership](../README.md) / resolveWriteUserId

# Function: resolveWriteUserId()

> **resolveWriteUserId**(`user`, `requestedUserId`): `object`

Defined in: [src/utils/ownership.ts:41](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/utils/ownership.ts#L41)

Wyciąga userId z dokumentu (z różnych miejsc) i weryfikuje prawo zapisu.
Dla nowych dokumentów (tworzonych) zwraca właściwy userId do zapisu:
 - admin może tworzyć dla dowolnego userId (np. dla sub-usera)
 - zwykły user zawsze user.id
 - pro może tworzyć dla siebie lub swoich subUsers

Zwraca: { allowed: boolean, effectiveUserId: string }

## Parameters

### user

`User` \| `undefined`

### requestedUserId

`string` \| `null` \| `undefined`

## Returns

`object`

### allowed

> **allowed**: `boolean`

### effectiveUserId

> **effectiveUserId**: `string`
