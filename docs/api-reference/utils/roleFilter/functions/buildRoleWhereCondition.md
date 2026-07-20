[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [utils/roleFilter](../README.md) / buildRoleWhereCondition

# Function: buildRoleWhereCondition()

> **buildRoleWhereCondition**(`user`): [`Sql`](../../../prismaClient/namespaces/Prisma/classes/Sql.md)

Defined in: [src/utils/roleFilter.ts:56](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/utils/roleFilter.ts#L56)

Bezpieczna (parametryzowana) wersja buildRoleWhereSql — zwraca Prisma.Sql
do użycia z prisma.$queryRaw (tagged template) zamiast $queryRawUnsafe.
Wartości są przekazywane jako parametry, co eliminuje ryzyko SQL Injection.

## Parameters

### user

`Pick`\<`User`, `"role"` \| `"id"` \| `"subUsers"`\>

## Returns

[`Sql`](../../../prismaClient/namespaces/Prisma/classes/Sql.md)
