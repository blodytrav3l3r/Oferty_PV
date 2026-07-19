[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [utils/searchUtils](../README.md) / buildOrderStatusSql

# Function: buildOrderStatusSql()

> **buildOrderStatusSql**(`orderStatus`): `object`

Defined in: [src/utils/searchUtils.ts:93](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/utils/searchUtils.ts#L93)

## Parameters

### orderStatus

`"all"` \| `"with_order"` \| `"without_order"`

## Returns

`object`

### joinSql

> **joinSql**: [`Sql`](../../../prismaClient/namespaces/Prisma/classes/Sql.md)

### whereSql

> **whereSql**: [`Sql`](../../../prismaClient/namespaces/Prisma/classes/Sql.md)
