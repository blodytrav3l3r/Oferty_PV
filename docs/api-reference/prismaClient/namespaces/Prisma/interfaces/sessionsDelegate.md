[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / sessionsDelegate

# Interface: sessionsDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:26125

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`sessionsFieldRefs`](sessionsFieldRefs.md)

Defined in: generated/prisma/index.d.ts:26497

Fields of the sessions model

## Methods

### aggregate()

> **aggregate**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetSessionsAggregateType`](../type-aliases/GetSessionsAggregateType.md)\<`T`\>\>

Defined in: generated/prisma/index.d.ts:26416

Allows you to perform aggregations operations on a Sessions.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`SessionsAggregateArgs`](../type-aliases/SessionsAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`SessionsAggregateArgs`](../type-aliases/SessionsAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetSessionsAggregateType`](../type-aliases/GetSessionsAggregateType.md)\<`T`\>\>

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

> **count**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof SessionsCountAggregateOutputType ? SessionsCountAggregateOutputType\[P\] : never \} : `number`\>

Defined in: generated/prisma/index.d.ts:26382

Count the number of Sessions.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`sessionsCountArgs`](../type-aliases/sessionsCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`sessionsCountArgs`](../type-aliases/sessionsCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Sessions to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof SessionsCountAggregateOutputType ? SessionsCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Sessions
const count = await prisma.sessions.count({
  where: {
    // ... the filter for the Sessions we want to count
  }
})
```

***

### create()

> **create**\<`T`\>(`args`): [`Prisma__sessionsClient`](Prisma__sessionsClient.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:26215

Create a Sessions.

#### Type Parameters

##### T

`T` *extends* [`sessionsCreateArgs`](../type-aliases/sessionsCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`sessionsCreateArgs`](../type-aliases/sessionsCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Sessions.

#### Returns

[`Prisma__sessionsClient`](Prisma__sessionsClient.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Sessions
const Sessions = await prisma.sessions.create({
  data: {
    // ... data to create a Sessions
  }
})
```

***

### createMany()

> **createMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:26229

Create many Sessions.

#### Type Parameters

##### T

`T` *extends* [`sessionsCreateManyArgs`](../type-aliases/sessionsCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`sessionsCreateManyArgs`](../type-aliases/sessionsCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Sessions.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Sessions
const sessions = await prisma.sessions.createMany({
  data: [
    // ... provide data here
  ]
})
```

***

### createManyAndReturn()

> **createManyAndReturn**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:26253

Create many Sessions and returns the data saved in the database.

#### Type Parameters

##### T

`T` *extends* [`sessionsCreateManyAndReturnArgs`](../type-aliases/sessionsCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`sessionsCreateManyAndReturnArgs`](../type-aliases/sessionsCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Sessions.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Sessions
const sessions = await prisma.sessions.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Sessions and only return the `token`
const sessionsWithTokenOnly = await prisma.sessions.createManyAndReturn({
  select: { token: true },
  data: [
    // ... provide data here
  ]
})
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined
```

***

### delete()

> **delete**\<`T`\>(`args`): [`Prisma__sessionsClient`](Prisma__sessionsClient.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:26267

Delete a Sessions.

#### Type Parameters

##### T

`T` *extends* [`sessionsDeleteArgs`](../type-aliases/sessionsDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`sessionsDeleteArgs`](../type-aliases/sessionsDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Sessions.

#### Returns

[`Prisma__sessionsClient`](Prisma__sessionsClient.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Sessions
const Sessions = await prisma.sessions.delete({
  where: {
    // ... filter to delete one Sessions
  }
})
```

***

### deleteMany()

> **deleteMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:26298

Delete zero or more Sessions.

#### Type Parameters

##### T

`T` *extends* [`sessionsDeleteManyArgs`](../type-aliases/sessionsDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`sessionsDeleteManyArgs`](../type-aliases/sessionsDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Sessions to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Sessions
const { count } = await prisma.sessions.deleteMany({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirst()

> **findFirst**\<`T`\>(`args?`): [`Prisma__sessionsClient`](Prisma__sessionsClient.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:26167

Find the first Sessions that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`sessionsFindFirstArgs`](../type-aliases/sessionsFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`sessionsFindFirstArgs`](../type-aliases/sessionsFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Sessions

#### Returns

[`Prisma__sessionsClient`](Prisma__sessionsClient.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Sessions
const sessions = await prisma.sessions.findFirst({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`\>(`args?`): [`Prisma__sessionsClient`](Prisma__sessionsClient.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:26183

Find the first Sessions that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`sessionsFindFirstOrThrowArgs`](../type-aliases/sessionsFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`sessionsFindFirstOrThrowArgs`](../type-aliases/sessionsFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Sessions

#### Returns

[`Prisma__sessionsClient`](Prisma__sessionsClient.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Sessions
const sessions = await prisma.sessions.findFirstOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### findMany()

> **findMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:26201

Find zero or more Sessions that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`sessionsFindManyArgs`](../type-aliases/sessionsFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`sessionsFindManyArgs`](../type-aliases/sessionsFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Sessions
const sessions = await prisma.sessions.findMany()

// Get first 10 Sessions
const sessions = await prisma.sessions.findMany({ take: 10 })

// Only select the `token`
const sessionsWithTokenOnly = await prisma.sessions.findMany({ select: { token: true } })
```

***

### findUnique()

> **findUnique**\<`T`\>(`args`): [`Prisma__sessionsClient`](Prisma__sessionsClient.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:26138

Find zero or one Sessions that matches the filter.

#### Type Parameters

##### T

`T` *extends* [`sessionsFindUniqueArgs`](../type-aliases/sessionsFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`sessionsFindUniqueArgs`](../type-aliases/sessionsFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Sessions

#### Returns

[`Prisma__sessionsClient`](Prisma__sessionsClient.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Sessions
const sessions = await prisma.sessions.findUnique({
  where: {
    // ... provide filter here
  }
})
```

***

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`\>(`args`): [`Prisma__sessionsClient`](Prisma__sessionsClient.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:26152

Find one Sessions that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` *extends* [`sessionsFindUniqueOrThrowArgs`](../type-aliases/sessionsFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`sessionsFindUniqueOrThrowArgs`](../type-aliases/sessionsFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Sessions

#### Returns

[`Prisma__sessionsClient`](Prisma__sessionsClient.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Sessions
const sessions = await prisma.sessions.findUniqueOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`\>(`args`): `object` *extends* `InputErrors` ? [`GetSessionsGroupByPayload`](../type-aliases/GetSessionsGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

Defined in: generated/prisma/index.d.ts:26436

Group by Sessions.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`sessionsGroupByArgs`](../type-aliases/sessionsGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` *extends* `0` \| `1`

##### OrderByArg

`OrderByArg` *extends* \{ `orderBy`: [`sessionsOrderByWithAggregationInput`](../type-aliases/sessionsOrderByWithAggregationInput.md) \| [`sessionsOrderByWithAggregationInput`](../type-aliases/sessionsOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`sessionsOrderByWithAggregationInput`](../type-aliases/sessionsOrderByWithAggregationInput.md) \| [`sessionsOrderByWithAggregationInput`](../type-aliases/sessionsOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` *extends* `"createdAt"` \| `"userId"` \| `"token"`

##### ByFields

`ByFields` *extends* [`SessionsScalarFieldEnum`](../type-aliases/SessionsScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof sessionsGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` *extends* `InputErrors` ? [`GetSessionsGroupByPayload`](../type-aliases/GetSessionsGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`\>(`args`): [`Prisma__sessionsClient`](Prisma__sessionsClient.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:26284

Update one Sessions.

#### Type Parameters

##### T

`T` *extends* [`sessionsUpdateArgs`](../type-aliases/sessionsUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`sessionsUpdateArgs`](../type-aliases/sessionsUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Sessions.

#### Returns

[`Prisma__sessionsClient`](Prisma__sessionsClient.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Sessions
const sessions = await prisma.sessions.update({
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

Defined in: generated/prisma/index.d.ts:26317

Update zero or more Sessions.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`sessionsUpdateManyArgs`](../type-aliases/sessionsUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`sessionsUpdateManyArgs`](../type-aliases/sessionsUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Sessions
const sessions = await prisma.sessions.updateMany({
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

> **updateManyAndReturn**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:26347

Update zero or more Sessions and returns the data updated in the database.

#### Type Parameters

##### T

`T` *extends* [`sessionsUpdateManyAndReturnArgs`](../type-aliases/sessionsUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`sessionsUpdateManyAndReturnArgs`](../type-aliases/sessionsUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Sessions.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Sessions
const sessions = await prisma.sessions.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Sessions and only return the `token`
const sessionsWithTokenOnly = await prisma.sessions.updateManyAndReturn({
  select: { token: true },
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

> **upsert**\<`T`\>(`args`): [`Prisma__sessionsClient`](Prisma__sessionsClient.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:26366

Create or update one Sessions.

#### Type Parameters

##### T

`T` *extends* [`sessionsUpsertArgs`](../type-aliases/sessionsUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`sessionsUpsertArgs`](../type-aliases/sessionsUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Sessions.

#### Returns

[`Prisma__sessionsClient`](Prisma__sessionsClient.md)\<`GetFindResult`\<[`$sessionsPayload`](../type-aliases/$sessionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Sessions
const sessions = await prisma.sessions.upsert({
  create: {
    // ... data to create a Sessions
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the Sessions we want to update
  }
})
```
