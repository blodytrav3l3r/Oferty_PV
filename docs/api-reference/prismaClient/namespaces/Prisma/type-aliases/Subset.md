[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / Subset

# Type Alias: Subset\<T, U\>

> **Subset**\<`T`, `U`> \> = `{ [key in keyof T]: key extends keyof U ? T[key] : never }`

Defined in: generated/prisma/index.d.ts:787

Subset

## Type Parameters

### T

`T`

### U

`U`

## Desc

From `T` pick properties that exist in `U`. Simple version of Intersection
