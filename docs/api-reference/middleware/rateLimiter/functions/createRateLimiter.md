[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [middleware/rateLimiter](../README.md) / createRateLimiter

# Function: createRateLimiter()

> **createRateLimiter**(`__namedParameters?`): (`req`, `res`, `next`) => `void`

Defined in: [src/middleware/rateLimiter.ts:18](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/middleware/rateLimiter.ts#L18)

Prosty In-Memory Rate Limiter.
Ogranicza liczbę żądań z jednego IP w oknie czasowym.

## Parameters

### \_\_namedParameters?

`RateLimiterOpts` = `{}`

## Returns

(`req`, `res`, `next`) => `void`
