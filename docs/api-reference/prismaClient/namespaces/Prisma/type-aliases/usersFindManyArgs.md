[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / usersFindManyArgs

# Type Alias: usersFindManyArgs\<ExtArgs\>

> **usersFindManyArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:38212

users findMany

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`usersWhereUniqueInput`](usersWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:38236

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for listing users.

---

### distinct?

> `optional` **distinct?**: [`UsersScalarFieldEnum`](UsersScalarFieldEnum.md) \| [`UsersScalarFieldEnum`](UsersScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:38249

---

### omit?

> `optional` **omit?**: [`usersOmit`](usersOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:38220

Omit specific fields from the users

---

### orderBy?

> `optional` **orderBy?**: [`usersOrderByWithRelationInput`](usersOrderByWithRelationInput.md) \| [`usersOrderByWithRelationInput`](usersOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:38230

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of users to fetch.

---

### select?

> `optional` **select?**: [`usersSelect`](usersSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:38216

Select specific fields to fetch from the users

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:38248

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` users.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:38242

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` users from the position of the cursor.

---

### where?

> `optional` **where?**: [`usersWhereInput`](usersWhereInput.md)

Defined in: generated/prisma/index.d.ts:38224

Filter, which users to fetch.
