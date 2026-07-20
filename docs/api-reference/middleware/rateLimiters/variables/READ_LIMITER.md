[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [middleware/rateLimiters](../README.md) / READ\_LIMITER

# Variable: READ\_LIMITER

> `const` **READ\_LIMITER**: (`req`, `res`, `next`) => `void`

Defined in: [src/middleware/rateLimiters.ts:29](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/middleware/rateLimiters.ts#L29)

Rate limiter dla odczytów telemetry (dashboard, historia).
Wyższe limity bo używany intensywnie przy pollingu.

## Parameters

### req

`Request`

### res

`Response`

### next

() => `void`

## Returns

`void`
