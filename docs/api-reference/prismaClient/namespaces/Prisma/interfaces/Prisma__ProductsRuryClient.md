[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / Prisma\_\_ProductsRuryClient

# Interface: Prisma\_\_ProductsRuryClient\<T, Null, ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:29598

The delegate class that acts as a "Promise-like" for ProductsRury.
Why is this prefixed with `Prisma__`?
Because we want to prevent naming conflicts as mentioned in
https://github.com/prisma/prisma-client-js/issues/707

## Extends

- [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T`\>

## Type Parameters

### T

`T`

### Null

`Null` = `never`

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Properties

### \[toStringTag\]

> `readonly` **\[toStringTag\]**: `"PrismaPromise"`

Defined in: generated/prisma/index.d.ts:29599

#### Overrides

`Prisma.PrismaPromise.[toStringTag]`

## Methods

### catch()

> **catch**\<`TResult`\>(`onrejected?`): `Promise`\<`T` \| `TResult`\>

Defined in: generated/prisma/index.d.ts:29613

Attaches a callback for only the rejection of the Promise.

#### Type Parameters

##### TResult

`TResult` = `never`

#### Parameters

##### onrejected?

((`reason`) => `TResult` \| `PromiseLike`\<`TResult`\>) \| `null`

The callback to execute when the Promise is rejected.

#### Returns

`Promise`\<`T` \| `TResult`\>

A Promise for the completion of the callback.

#### Overrides

`Prisma.PrismaPromise.catch`

***

### category\_rel()

> **category\_rel**\<`T`\>(`args?`): [`Prisma__CategoriesRuryClient`](Prisma__CategoriesRuryClient.md)\<`Null` \| `GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `Null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:29600

#### Type Parameters

##### T

`T` *extends* [`CategoriesRuryDefaultArgs`](../type-aliases/CategoriesRuryDefaultArgs.md)\<`ExtArgs`\> = \{ \}

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`CategoriesRuryDefaultArgs`](../type-aliases/CategoriesRuryDefaultArgs.md)\<`ExtArgs`\>\>

#### Returns

[`Prisma__CategoriesRuryClient`](Prisma__CategoriesRuryClient.md)\<`Null` \| `GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `Null`, `ExtArgs`, `GlobalOmitOptions`\>

***

### finally()

> **finally**(`onfinally?`): `Promise`\<`T`\>

Defined in: generated/prisma/index.d.ts:29620

Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
resolved value cannot be modified from the callback.

#### Parameters

##### onfinally?

(() => `void`) \| `null`

The callback to execute when the Promise is settled (fulfilled or rejected).

#### Returns

`Promise`\<`T`\>

A Promise for the completion of the callback.

#### Overrides

`Prisma.PrismaPromise.finally`

***

### then()

> **then**\<`TResult1`, `TResult2`\>(`onfulfilled?`, `onrejected?`): `Promise`\<`TResult1` \| `TResult2`\>

Defined in: generated/prisma/index.d.ts:29607

Attaches callbacks for the resolution and/or rejection of the Promise.

#### Type Parameters

##### TResult1

`TResult1` = `T`

##### TResult2

`TResult2` = `never`

#### Parameters

##### onfulfilled?

((`value`) => `TResult1` \| `PromiseLike`\<`TResult1`\>) \| `null`

The callback to execute when the Promise is resolved.

##### onrejected?

((`reason`) => `TResult2` \| `PromiseLike`\<`TResult2`\>) \| `null`

The callback to execute when the Promise is rejected.

#### Returns

`Promise`\<`TResult1` \| `TResult2`\>

A Promise for the completion of which ever callback is executed.

#### Overrides

`Prisma.PrismaPromise.then`
