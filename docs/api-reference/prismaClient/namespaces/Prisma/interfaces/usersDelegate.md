[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / usersDelegate

# Interface: usersDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:37647

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`usersFieldRefs`](usersFieldRefs.md)

Defined in: generated/prisma/index.d.ts:38019

Fields of the users model

## Methods

### aggregate()

> **aggregate**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetUsersAggregateType`](../type-aliases/GetUsersAggregateType.md)\<`T`\>\>

Defined in: generated/prisma/index.d.ts:37938

Allows you to perform aggregations operations on a Users.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`UsersAggregateArgs`](../type-aliases/UsersAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`UsersAggregateArgs`](../type-aliases/UsersAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetUsersAggregateType`](../type-aliases/GetUsersAggregateType.md)\<`T`\>\>

#### Example

```ts
// Ordered by age ascending
// Where email contains prisma.io
// Limited to the 10 users
const aggregations = await prisma.user.aggregate({
  _avg: {
    age: true,
  },
  where: {
    email: {
      contains: "prisma.io",
    },
  },
  orderBy: {
    age: "asc",
  },
  take: 10,
})
```

***

### count()

> **count**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof UsersCountAggregateOutputType ? UsersCountAggregateOutputType\[P\] : never \} : `number`\>

Defined in: generated/prisma/index.d.ts:37904

Count the number of Users.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`usersCountArgs`](../type-aliases/usersCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`usersCountArgs`](../type-aliases/usersCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Users to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof UsersCountAggregateOutputType ? UsersCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Users
const count = await prisma.users.count({
  where: {
    // ... the filter for the Users we want to count
  }
})
```

***

### create()

> **create**\<`T`\>(`args`): [`Prisma__usersClient`](Prisma__usersClient.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:37737

Create a Users.

#### Type Parameters

##### T

`T` *extends* [`usersCreateArgs`](../type-aliases/usersCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`usersCreateArgs`](../type-aliases/usersCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Users.

#### Returns

[`Prisma__usersClient`](Prisma__usersClient.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Users
const Users = await prisma.users.create({
  data: {
    // ... data to create a Users
  }
})
```

***

### createMany()

> **createMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:37751

Create many Users.

#### Type Parameters

##### T

`T` *extends* [`usersCreateManyArgs`](../type-aliases/usersCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`usersCreateManyArgs`](../type-aliases/usersCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Users.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Users
const users = await prisma.users.createMany({
  data: [
    // ... provide data here
  ]
})
```

***

### createManyAndReturn()

> **createManyAndReturn**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:37775

Create many Users and returns the data saved in the database.

#### Type Parameters

##### T

`T` *extends* [`usersCreateManyAndReturnArgs`](../type-aliases/usersCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`usersCreateManyAndReturnArgs`](../type-aliases/usersCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Users.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Users
const users = await prisma.users.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Users and only return the `id`
const usersWithIdOnly = await prisma.users.createManyAndReturn({
  select: { id: true },
  data: [
    // ... provide data here
  ]
})
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined
```

***

### delete()

> **delete**\<`T`\>(`args`): [`Prisma__usersClient`](Prisma__usersClient.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:37789

Delete a Users.

#### Type Parameters

##### T

`T` *extends* [`usersDeleteArgs`](../type-aliases/usersDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`usersDeleteArgs`](../type-aliases/usersDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Users.

#### Returns

[`Prisma__usersClient`](Prisma__usersClient.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Users
const Users = await prisma.users.delete({
  where: {
    // ... filter to delete one Users
  }
})
```

***

### deleteMany()

> **deleteMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:37820

Delete zero or more Users.

#### Type Parameters

##### T

`T` *extends* [`usersDeleteManyArgs`](../type-aliases/usersDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`usersDeleteManyArgs`](../type-aliases/usersDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Users to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Users
const { count } = await prisma.users.deleteMany({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirst()

> **findFirst**\<`T`\>(`args?`): [`Prisma__usersClient`](Prisma__usersClient.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:37689

Find the first Users that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`usersFindFirstArgs`](../type-aliases/usersFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`usersFindFirstArgs`](../type-aliases/usersFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Users

#### Returns

[`Prisma__usersClient`](Prisma__usersClient.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Users
const users = await prisma.users.findFirst({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`\>(`args?`): [`Prisma__usersClient`](Prisma__usersClient.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:37705

Find the first Users that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`usersFindFirstOrThrowArgs`](../type-aliases/usersFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`usersFindFirstOrThrowArgs`](../type-aliases/usersFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Users

#### Returns

[`Prisma__usersClient`](Prisma__usersClient.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Users
const users = await prisma.users.findFirstOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### findMany()

> **findMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:37723

Find zero or more Users that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`usersFindManyArgs`](../type-aliases/usersFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`usersFindManyArgs`](../type-aliases/usersFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Users
const users = await prisma.users.findMany()

// Get first 10 Users
const users = await prisma.users.findMany({ take: 10 })

// Only select the `id`
const usersWithIdOnly = await prisma.users.findMany({ select: { id: true } })
```

***

### findUnique()

> **findUnique**\<`T`\>(`args`): [`Prisma__usersClient`](Prisma__usersClient.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:37660

Find zero or one Users that matches the filter.

#### Type Parameters

##### T

`T` *extends* [`usersFindUniqueArgs`](../type-aliases/usersFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`usersFindUniqueArgs`](../type-aliases/usersFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Users

#### Returns

[`Prisma__usersClient`](Prisma__usersClient.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Users
const users = await prisma.users.findUnique({
  where: {
    // ... provide filter here
  }
})
```

***

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`\>(`args`): [`Prisma__usersClient`](Prisma__usersClient.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:37674

Find one Users that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` *extends* [`usersFindUniqueOrThrowArgs`](../type-aliases/usersFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`usersFindUniqueOrThrowArgs`](../type-aliases/usersFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Users

#### Returns

[`Prisma__usersClient`](Prisma__usersClient.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Users
const users = await prisma.users.findUniqueOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`\>(`args`): `object` *extends* `InputErrors` ? [`GetUsersGroupByPayload`](../type-aliases/GetUsersGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

Defined in: generated/prisma/index.d.ts:37958

Group by Users.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`usersGroupByArgs`](../type-aliases/usersGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` *extends* `0` \| `1`

##### OrderByArg

`OrderByArg` *extends* \{ `orderBy`: [`usersOrderByWithAggregationInput`](../type-aliases/usersOrderByWithAggregationInput.md) \| [`usersOrderByWithAggregationInput`](../type-aliases/usersOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`usersOrderByWithAggregationInput`](../type-aliases/usersOrderByWithAggregationInput.md) \| [`usersOrderByWithAggregationInput`](../type-aliases/usersOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` *extends* `"symbol"` \| `"id"` \| `"createdAt"` \| `"role"` \| `"subUsers"` \| `"username"` \| `"password"` \| `"firstName"` \| `"lastName"` \| `"phone"` \| `"email"` \| `"orderStartNumber"` \| `"productionOrderStartNumber"` \| `"totalReward"`

##### ByFields

`ByFields` *extends* [`UsersScalarFieldEnum`](../type-aliases/UsersScalarFieldEnum.md)

##### ByValid

`ByValid` *extends* `0` \| `1`

##### HavingFields

`HavingFields` *extends* `string` \| `number` \| `symbol`

##### HavingValid

`HavingValid`

##### ByEmpty

`ByEmpty` *extends* `0` \| `1`

##### InputErrors

`InputErrors`

#### Parameters

##### args

\{ \[key in string \| number \| symbol\]: key extends keyof usersGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` *extends* `InputErrors` ? [`GetUsersGroupByPayload`](../type-aliases/GetUsersGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

#### Example

```ts
// Group by city, order by createdAt, get count
const result = await prisma.user.groupBy({
  by: ['city', 'createdAt'],
  orderBy: {
    createdAt: true
  },
  _count: {
    _all: true
  },
})
```

***

### update()

> **update**\<`T`\>(`args`): [`Prisma__usersClient`](Prisma__usersClient.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:37806

Update one Users.

#### Type Parameters

##### T

`T` *extends* [`usersUpdateArgs`](../type-aliases/usersUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`usersUpdateArgs`](../type-aliases/usersUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Users.

#### Returns

[`Prisma__usersClient`](Prisma__usersClient.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Users
const users = await prisma.users.update({
  where: {
    // ... provide filter here
  },
  data: {
    // ... provide data here
  }
})
```

***

### updateMany()

> **updateMany**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:37839

Update zero or more Users.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`usersUpdateManyArgs`](../type-aliases/usersUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`usersUpdateManyArgs`](../type-aliases/usersUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Users
const users = await prisma.users.updateMany({
  where: {
    // ... provide filter here
  },
  data: {
    // ... provide data here
  }
})
```

***

### updateManyAndReturn()

> **updateManyAndReturn**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:37869

Update zero or more Users and returns the data updated in the database.

#### Type Parameters

##### T

`T` *extends* [`usersUpdateManyAndReturnArgs`](../type-aliases/usersUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`usersUpdateManyAndReturnArgs`](../type-aliases/usersUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Users.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Users
const users = await prisma.users.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Users and only return the `id`
const usersWithIdOnly = await prisma.users.updateManyAndReturn({
  select: { id: true },
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined
```

***

### upsert()

> **upsert**\<`T`\>(`args`): [`Prisma__usersClient`](Prisma__usersClient.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:37888

Create or update one Users.

#### Type Parameters

##### T

`T` *extends* [`usersUpsertArgs`](../type-aliases/usersUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`usersUpsertArgs`](../type-aliases/usersUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Users.

#### Returns

[`Prisma__usersClient`](Prisma__usersClient.md)\<`GetFindResult`\<[`$usersPayload`](../type-aliases/$usersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Users
const users = await prisma.users.upsert({
  create: {
    // ... data to create a Users
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the Users we want to update
  }
})
```
