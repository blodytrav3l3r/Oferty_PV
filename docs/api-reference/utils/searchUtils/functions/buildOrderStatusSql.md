[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [utils/searchUtils](../README.md) / buildOrderStatusSql

# Function: buildOrderStatusSql()

> **buildOrderStatusSql**(`orderStatus`): `object`

Defined in: [src/utils/searchUtils.ts:93](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/utils/searchUtils.ts#L93)

## Parameters

### orderStatus

`"all"` \| `"with_order"` \| `"without_order"`

## Returns

`object`

### joinSql

> **joinSql**: [`Sql`](../../../prismaClient/namespaces/Prisma/classes/Sql.md)

### whereSql

> **whereSql**: [`Sql`](../../../prismaClient/namespaces/Prisma/classes/Sql.md)
