[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AtLeast

# Type Alias: AtLeast\<O, K\>

> **AtLeast**\<`O`, `K`> \> = [`NoExpand`](NoExpand.md)\<`O` _extends_ `unknown` ? `K` _extends_ keyof `O` ? `{ [P in K]: O[P] }` & `O` : `O` \| `{ [P in keyof O as P extends K ? P : never]-?: O[P] }` & `O` : `never`>\>

Defined in: generated/prisma/index.d.ts:923

## Type Parameters

### O

`O` _extends_ `object`

### K

`K` _extends_ `string`
