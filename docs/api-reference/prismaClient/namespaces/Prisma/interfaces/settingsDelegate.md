[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / settingsDelegate

# Interface: settingsDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:27080

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`settingsFieldRefs`](settingsFieldRefs.md)

Defined in: generated/prisma/index.d.ts:27452

Fields of the settings model

## Methods

### aggregate()

> **aggregate**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetSettingsAggregateType`](../type-aliases/GetSettingsAggregateType.md)\<`T`\>\>

Defined in: generated/prisma/index.d.ts:27371

Allows you to perform aggregations operations on a Settings.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`SettingsAggregateArgs`](../type-aliases/SettingsAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`SettingsAggregateArgs`](../type-aliases/SettingsAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetSettingsAggregateType`](../type-aliases/GetSettingsAggregateType.md)\<`T`\>\>

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

> **count**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof SettingsCountAggregateOutputType ? SettingsCountAggregateOutputType\[P\] : never \} : `number`\>

Defined in: generated/prisma/index.d.ts:27337

Count the number of Settings.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`settingsCountArgs`](../type-aliases/settingsCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`settingsCountArgs`](../type-aliases/settingsCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Settings to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof SettingsCountAggregateOutputType ? SettingsCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Settings
const count = await prisma.settings.count({
  where: {
    // ... the filter for the Settings we want to count
  }
})
```

***

### create()

> **create**\<`T`\>(`args`): [`Prisma__settingsClient`](Prisma__settingsClient.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:27170

Create a Settings.

#### Type Parameters

##### T

`T` *extends* [`settingsCreateArgs`](../type-aliases/settingsCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`settingsCreateArgs`](../type-aliases/settingsCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Settings.

#### Returns

[`Prisma__settingsClient`](Prisma__settingsClient.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Settings
const Settings = await prisma.settings.create({
  data: {
    // ... data to create a Settings
  }
})
```

***

### createMany()

> **createMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:27184

Create many Settings.

#### Type Parameters

##### T

`T` *extends* [`settingsCreateManyArgs`](../type-aliases/settingsCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`settingsCreateManyArgs`](../type-aliases/settingsCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Settings.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Settings
const settings = await prisma.settings.createMany({
  data: [
    // ... provide data here
  ]
})
```

***

### createManyAndReturn()

> **createManyAndReturn**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:27208

Create many Settings and returns the data saved in the database.

#### Type Parameters

##### T

`T` *extends* [`settingsCreateManyAndReturnArgs`](../type-aliases/settingsCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`settingsCreateManyAndReturnArgs`](../type-aliases/settingsCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Settings.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Settings
const settings = await prisma.settings.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Settings and only return the `key`
const settingsWithKeyOnly = await prisma.settings.createManyAndReturn({
  select: { key: true },
  data: [
    // ... provide data here
  ]
})
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined
```

***

### delete()

> **delete**\<`T`\>(`args`): [`Prisma__settingsClient`](Prisma__settingsClient.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:27222

Delete a Settings.

#### Type Parameters

##### T

`T` *extends* [`settingsDeleteArgs`](../type-aliases/settingsDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`settingsDeleteArgs`](../type-aliases/settingsDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Settings.

#### Returns

[`Prisma__settingsClient`](Prisma__settingsClient.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Settings
const Settings = await prisma.settings.delete({
  where: {
    // ... filter to delete one Settings
  }
})
```

***

### deleteMany()

> **deleteMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:27253

Delete zero or more Settings.

#### Type Parameters

##### T

`T` *extends* [`settingsDeleteManyArgs`](../type-aliases/settingsDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`settingsDeleteManyArgs`](../type-aliases/settingsDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Settings to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Settings
const { count } = await prisma.settings.deleteMany({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirst()

> **findFirst**\<`T`\>(`args?`): [`Prisma__settingsClient`](Prisma__settingsClient.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:27122

Find the first Settings that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`settingsFindFirstArgs`](../type-aliases/settingsFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`settingsFindFirstArgs`](../type-aliases/settingsFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Settings

#### Returns

[`Prisma__settingsClient`](Prisma__settingsClient.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Settings
const settings = await prisma.settings.findFirst({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`\>(`args?`): [`Prisma__settingsClient`](Prisma__settingsClient.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:27138

Find the first Settings that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`settingsFindFirstOrThrowArgs`](../type-aliases/settingsFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`settingsFindFirstOrThrowArgs`](../type-aliases/settingsFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Settings

#### Returns

[`Prisma__settingsClient`](Prisma__settingsClient.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Settings
const settings = await prisma.settings.findFirstOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### findMany()

> **findMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:27156

Find zero or more Settings that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`settingsFindManyArgs`](../type-aliases/settingsFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`settingsFindManyArgs`](../type-aliases/settingsFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Settings
const settings = await prisma.settings.findMany()

// Get first 10 Settings
const settings = await prisma.settings.findMany({ take: 10 })

// Only select the `key`
const settingsWithKeyOnly = await prisma.settings.findMany({ select: { key: true } })
```

***

### findUnique()

> **findUnique**\<`T`\>(`args`): [`Prisma__settingsClient`](Prisma__settingsClient.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:27093

Find zero or one Settings that matches the filter.

#### Type Parameters

##### T

`T` *extends* [`settingsFindUniqueArgs`](../type-aliases/settingsFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`settingsFindUniqueArgs`](../type-aliases/settingsFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Settings

#### Returns

[`Prisma__settingsClient`](Prisma__settingsClient.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Settings
const settings = await prisma.settings.findUnique({
  where: {
    // ... provide filter here
  }
})
```

***

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`\>(`args`): [`Prisma__settingsClient`](Prisma__settingsClient.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:27107

Find one Settings that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` *extends* [`settingsFindUniqueOrThrowArgs`](../type-aliases/settingsFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`settingsFindUniqueOrThrowArgs`](../type-aliases/settingsFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Settings

#### Returns

[`Prisma__settingsClient`](Prisma__settingsClient.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Settings
const settings = await prisma.settings.findUniqueOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`\>(`args`): `object` *extends* `InputErrors` ? [`GetSettingsGroupByPayload`](../type-aliases/GetSettingsGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

Defined in: generated/prisma/index.d.ts:27391

Group by Settings.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`settingsGroupByArgs`](../type-aliases/settingsGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` *extends* `0` \| `1`

##### OrderByArg

`OrderByArg` *extends* \{ `orderBy`: [`settingsOrderByWithAggregationInput`](../type-aliases/settingsOrderByWithAggregationInput.md) \| [`settingsOrderByWithAggregationInput`](../type-aliases/settingsOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`settingsOrderByWithAggregationInput`](../type-aliases/settingsOrderByWithAggregationInput.md) \| [`settingsOrderByWithAggregationInput`](../type-aliases/settingsOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` *extends* `"value"` \| `"key"`

##### ByFields

`ByFields` *extends* [`SettingsScalarFieldEnum`](../type-aliases/SettingsScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof settingsGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` *extends* `InputErrors` ? [`GetSettingsGroupByPayload`](../type-aliases/GetSettingsGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`\>(`args`): [`Prisma__settingsClient`](Prisma__settingsClient.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:27239

Update one Settings.

#### Type Parameters

##### T

`T` *extends* [`settingsUpdateArgs`](../type-aliases/settingsUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`settingsUpdateArgs`](../type-aliases/settingsUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Settings.

#### Returns

[`Prisma__settingsClient`](Prisma__settingsClient.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Settings
const settings = await prisma.settings.update({
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

Defined in: generated/prisma/index.d.ts:27272

Update zero or more Settings.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`settingsUpdateManyArgs`](../type-aliases/settingsUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`settingsUpdateManyArgs`](../type-aliases/settingsUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Settings
const settings = await prisma.settings.updateMany({
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

> **updateManyAndReturn**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:27302

Update zero or more Settings and returns the data updated in the database.

#### Type Parameters

##### T

`T` *extends* [`settingsUpdateManyAndReturnArgs`](../type-aliases/settingsUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`settingsUpdateManyAndReturnArgs`](../type-aliases/settingsUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Settings.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Settings
const settings = await prisma.settings.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Settings and only return the `key`
const settingsWithKeyOnly = await prisma.settings.updateManyAndReturn({
  select: { key: true },
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

> **upsert**\<`T`\>(`args`): [`Prisma__settingsClient`](Prisma__settingsClient.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:27321

Create or update one Settings.

#### Type Parameters

##### T

`T` *extends* [`settingsUpsertArgs`](../type-aliases/settingsUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`settingsUpsertArgs`](../type-aliases/settingsUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Settings.

#### Returns

[`Prisma__settingsClient`](Prisma__settingsClient.md)\<`GetFindResult`\<[`$settingsPayload`](../type-aliases/$settingsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Settings
const settings = await prisma.settings.upsert({
  create: {
    // ... data to create a Settings
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the Settings we want to update
  }
})
```
