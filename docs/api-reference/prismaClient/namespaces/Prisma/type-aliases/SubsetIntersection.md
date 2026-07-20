[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / SubsetIntersection

# Type Alias: SubsetIntersection\<T, U, K\>

> **SubsetIntersection**\<`T`, `U`, `K`\> = `{ [key in keyof T]: key extends keyof U ? T[key] : never }` & `K`

Defined in: generated/prisma/index.d.ts:809

Subset + Intersection

## Type Parameters

### T

`T`

### U

`U`

### K

`K`

## Desc

From `T` pick properties that exist in `U` and intersect `K`
