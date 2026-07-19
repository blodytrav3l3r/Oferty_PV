[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [utils/ownership](../README.md) / canWriteDoc

# Function: canWriteDoc()

> **canWriteDoc**(`user`, `docUserId`): `boolean`

Defined in: [src/utils/ownership.ts:23](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/utils/ownership.ts#L23)

Sprawdza czy user może zapisać dokument (tworzyć / aktualizować).
Reguły:

- admin: zawsze
- owner (docUserId === user.id): tak
- pro parent (docUserId in subUsers): tak
- user impersonation via body (docUserId !== user.id i nie pro-parent): NIE

## Parameters

### user

`User` \| `undefined`

### docUserId

`string` \| `null` \| `undefined`

## Returns

`boolean`
