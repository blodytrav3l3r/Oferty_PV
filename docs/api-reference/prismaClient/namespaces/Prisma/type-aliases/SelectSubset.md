[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / SelectSubset

# Type Alias: SelectSubset\<T, U\>

> **SelectSubset**\<`T`, `U`> \> = `{ [key in keyof T]: key extends keyof U ? T[key] : never }` & `T` _extends_ [`SelectAndInclude`](SelectAndInclude.md) ? ``"Please either choose `select` or `include`."`` : `T` _extends_ [`SelectAndOmit`](SelectAndOmit.md) ? ``"Please either choose `select` or `omit`."`` : `object`

Defined in: generated/prisma/index.d.ts:796

SelectSubset

## Type Parameters

### T

`T`

### U

`U`

## Desc

From `T` pick properties that exist in `U`. Simple version of Intersection.
Additionally, it validates, if both select and include are present. If the case, it errors.
