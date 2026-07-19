[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / usersFindFirstArgs

# Type Alias: usersFindFirstArgs\<ExtArgs\>

> **usersFindFirstArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:38116

users findFirst

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`usersWhereUniqueInput`](usersWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:38140

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for users.

---

### distinct?

> `optional` **distinct?**: [`UsersScalarFieldEnum`](UsersScalarFieldEnum.md) \| [`UsersScalarFieldEnum`](UsersScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:38158

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of users.

---

### omit?

> `optional` **omit?**: [`usersOmit`](usersOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:38124

Omit specific fields from the users

---

### orderBy?

> `optional` **orderBy?**: [`usersOrderByWithRelationInput`](usersOrderByWithRelationInput.md) \| [`usersOrderByWithRelationInput`](usersOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:38134

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of users to fetch.

---

### select?

> `optional` **select?**: [`usersSelect`](usersSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:38120

Select specific fields to fetch from the users

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:38152

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` users.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:38146

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` users from the position of the cursor.

---

### where?

> `optional` **where?**: [`usersWhereInput`](usersWhereInput.md)

Defined in: generated/prisma/index.d.ts:38128

Filter, which users to fetch.
