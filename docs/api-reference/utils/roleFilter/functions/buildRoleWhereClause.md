[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [utils/roleFilter](../README.md) / buildRoleWhereClause

# Function: buildRoleWhereClause()

> **buildRoleWhereClause**(`user`): \{ `userId`: \{ `in`: `string`[]; \}; \} \| \{ `userId`: `string`; \} \| `undefined`

Defined in: [src/utils/roleFilter.ts:12](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/utils/roleFilter.ts#L12)

Zwraca część klauzuli 'where' dla Prisma Client
w oparciu o poziom uprawnień podanego użytkownika.

- 'admin' widzi wszystkie dane
- 'pro' widzi dane swoje i swoich 'subUsers'
- domyślnie ('user') widzi wyłącznie własne wpisy

## Parameters

### user

`User`

## Returns

\{ `userId`: \{ `in`: `string`[]; \}; \} \| \{ `userId`: `string`; \} \| `undefined`
