[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [utils/roleFilter](../README.md) / buildRoleWhereSql

# Function: buildRoleWhereSql()

> **buildRoleWhereSql**(`user`): `string`

Defined in: [src/utils/roleFilter.ts:38](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/utils/roleFilter.ts#L38)

Buduje fragment klauzuli WHERE dla raw SQL queries (z prefiksem "WHERE"
lub pusty string) respektujący rolę użytkownika.

Używane w miejscach, gdzie potrzebna jest konwersja dat w tym samym
query (timestamp ms → ISO datetime), czego Prisma Client nie wspiera
natywnie dla SQLite.

Bezpieczeństwo: każde ID jest walidowane isValidId() i escapowane
przez podwójny apostrof (SQL standard).

## Parameters

### user

`Pick`\<`User`, `"role"` \| `"id"` \| `"subUsers"`\>

## Returns

`string`
