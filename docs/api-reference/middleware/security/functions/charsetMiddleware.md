[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [middleware/security](../README.md) / charsetMiddleware

# Function: charsetMiddleware()

> **charsetMiddleware**(`_req`, `res`, `next`): `void`

Defined in: [src/middleware/security.ts:36](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/middleware/security.ts#L36)

Wymusza charset=utf-8 w nagłówku Content-Type dla odpowiedzi tekstowych.
Zapobiega nieprawidłowemu dekodowaniu polskich znaków przez przeglądarkę.

## Parameters

### \_req

`Request`

### res

`Response`

### next

`NextFunction`

## Returns

`void`
