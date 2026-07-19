[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / usersFindFirstOrThrowArgs

# Type Alias: usersFindFirstOrThrowArgs\<ExtArgs\>

> **usersFindFirstOrThrowArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:38164

users findFirstOrThrow

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`usersWhereUniqueInput`](usersWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:38188

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for users.

---

### distinct?

> `optional` **distinct?**: [`UsersScalarFieldEnum`](UsersScalarFieldEnum.md) \| [`UsersScalarFieldEnum`](UsersScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:38206

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of users.

---

### omit?

> `optional` **omit?**: [`usersOmit`](usersOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:38172

Omit specific fields from the users

---

### orderBy?

> `optional` **orderBy?**: [`usersOrderByWithRelationInput`](usersOrderByWithRelationInput.md) \| [`usersOrderByWithRelationInput`](usersOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:38182

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of users to fetch.

---

### select?

> `optional` **select?**: [`usersSelect`](usersSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:38168

Select specific fields to fetch from the users

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:38200

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` users.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:38194

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` users from the position of the cursor.

---

### where?

> `optional` **where?**: [`usersWhereInput`](usersWhereInput.md)

Defined in: generated/prisma/index.d.ts:38176

Filter, which users to fetch.
