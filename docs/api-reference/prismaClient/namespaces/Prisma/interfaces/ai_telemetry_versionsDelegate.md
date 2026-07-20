[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_telemetry\_versionsDelegate

# Interface: ai\_telemetry\_versionsDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:7966

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`ai_telemetry_versionsFieldRefs`](ai_telemetry_versionsFieldRefs.md)

Defined in: generated/prisma/index.d.ts:8338

Fields of the ai_telemetry_versions model

## Methods

### aggregate()

> **aggregate**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAi_telemetry_versionsAggregateType`](../type-aliases/GetAi_telemetry_versionsAggregateType.md)\<`T`\>\>

Defined in: generated/prisma/index.d.ts:8257

Allows you to perform aggregations operations on a Ai_telemetry_versions.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`Ai_telemetry_versionsAggregateArgs`](../type-aliases/Ai_telemetry_versionsAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`Ai_telemetry_versionsAggregateArgs`](../type-aliases/Ai_telemetry_versionsAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAi_telemetry_versionsAggregateType`](../type-aliases/GetAi_telemetry_versionsAggregateType.md)\<`T`\>\>

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

> **count**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Ai\_telemetry\_versionsCountAggregateOutputType ? Ai\_telemetry\_versionsCountAggregateOutputType\[P\] : never \} : `number`\>

Defined in: generated/prisma/index.d.ts:8223

Count the number of Ai_telemetry_versions.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_versionsCountArgs`](../type-aliases/ai_telemetry_versionsCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`ai_telemetry_versionsCountArgs`](../type-aliases/ai_telemetry_versionsCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Ai_telemetry_versions to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Ai\_telemetry\_versionsCountAggregateOutputType ? Ai\_telemetry\_versionsCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Ai_telemetry_versions
const count = await prisma.ai_telemetry_versions.count({
  where: {
    // ... the filter for the Ai_telemetry_versions we want to count
  }
})
```

***

### create()

> **create**\<`T`\>(`args`): [`Prisma__ai_telemetry_versionsClient`](Prisma__ai_telemetry_versionsClient.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:8056

Create a Ai_telemetry_versions.

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_versionsCreateArgs`](../type-aliases/ai_telemetry_versionsCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_versionsCreateArgs`](../type-aliases/ai_telemetry_versionsCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Ai_telemetry_versions.

#### Returns

[`Prisma__ai_telemetry_versionsClient`](Prisma__ai_telemetry_versionsClient.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Ai_telemetry_versions
const Ai_telemetry_versions = await prisma.ai_telemetry_versions.create({
  data: {
    // ... data to create a Ai_telemetry_versions
  }
})
```

***

### createMany()

> **createMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:8070

Create many Ai_telemetry_versions.

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_versionsCreateManyArgs`](../type-aliases/ai_telemetry_versionsCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_versionsCreateManyArgs`](../type-aliases/ai_telemetry_versionsCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Ai_telemetry_versions.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Ai_telemetry_versions
const ai_telemetry_versions = await prisma.ai_telemetry_versions.createMany({
  data: [
    // ... provide data here
  ]
})
```

***

### createManyAndReturn()

> **createManyAndReturn**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:8094

Create many Ai_telemetry_versions and returns the data saved in the database.

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_versionsCreateManyAndReturnArgs`](../type-aliases/ai_telemetry_versionsCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_versionsCreateManyAndReturnArgs`](../type-aliases/ai_telemetry_versionsCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Ai_telemetry_versions.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Ai_telemetry_versions
const ai_telemetry_versions = await prisma.ai_telemetry_versions.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Ai_telemetry_versions and only return the `id`
const ai_telemetry_versionsWithIdOnly = await prisma.ai_telemetry_versions.createManyAndReturn({
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

> **delete**\<`T`\>(`args`): [`Prisma__ai_telemetry_versionsClient`](Prisma__ai_telemetry_versionsClient.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:8108

Delete a Ai_telemetry_versions.

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_versionsDeleteArgs`](../type-aliases/ai_telemetry_versionsDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_versionsDeleteArgs`](../type-aliases/ai_telemetry_versionsDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Ai_telemetry_versions.

#### Returns

[`Prisma__ai_telemetry_versionsClient`](Prisma__ai_telemetry_versionsClient.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Ai_telemetry_versions
const Ai_telemetry_versions = await prisma.ai_telemetry_versions.delete({
  where: {
    // ... filter to delete one Ai_telemetry_versions
  }
})
```

***

### deleteMany()

> **deleteMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:8139

Delete zero or more Ai_telemetry_versions.

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_versionsDeleteManyArgs`](../type-aliases/ai_telemetry_versionsDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_versionsDeleteManyArgs`](../type-aliases/ai_telemetry_versionsDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Ai_telemetry_versions to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Ai_telemetry_versions
const { count } = await prisma.ai_telemetry_versions.deleteMany({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirst()

> **findFirst**\<`T`\>(`args?`): [`Prisma__ai_telemetry_versionsClient`](Prisma__ai_telemetry_versionsClient.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:8008

Find the first Ai_telemetry_versions that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_versionsFindFirstArgs`](../type-aliases/ai_telemetry_versionsFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_versionsFindFirstArgs`](../type-aliases/ai_telemetry_versionsFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_telemetry_versions

#### Returns

[`Prisma__ai_telemetry_versionsClient`](Prisma__ai_telemetry_versionsClient.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_telemetry_versions
const ai_telemetry_versions = await prisma.ai_telemetry_versions.findFirst({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`\>(`args?`): [`Prisma__ai_telemetry_versionsClient`](Prisma__ai_telemetry_versionsClient.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:8024

Find the first Ai_telemetry_versions that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_versionsFindFirstOrThrowArgs`](../type-aliases/ai_telemetry_versionsFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_versionsFindFirstOrThrowArgs`](../type-aliases/ai_telemetry_versionsFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_telemetry_versions

#### Returns

[`Prisma__ai_telemetry_versionsClient`](Prisma__ai_telemetry_versionsClient.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_telemetry_versions
const ai_telemetry_versions = await prisma.ai_telemetry_versions.findFirstOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### findMany()

> **findMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:8042

Find zero or more Ai_telemetry_versions that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_versionsFindManyArgs`](../type-aliases/ai_telemetry_versionsFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_versionsFindManyArgs`](../type-aliases/ai_telemetry_versionsFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Ai_telemetry_versions
const ai_telemetry_versions = await prisma.ai_telemetry_versions.findMany()

// Get first 10 Ai_telemetry_versions
const ai_telemetry_versions = await prisma.ai_telemetry_versions.findMany({ take: 10 })

// Only select the `id`
const ai_telemetry_versionsWithIdOnly = await prisma.ai_telemetry_versions.findMany({ select: { id: true } })
```

***

### findUnique()

> **findUnique**\<`T`\>(`args`): [`Prisma__ai_telemetry_versionsClient`](Prisma__ai_telemetry_versionsClient.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:7979

Find zero or one Ai_telemetry_versions that matches the filter.

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_versionsFindUniqueArgs`](../type-aliases/ai_telemetry_versionsFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_versionsFindUniqueArgs`](../type-aliases/ai_telemetry_versionsFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_telemetry_versions

#### Returns

[`Prisma__ai_telemetry_versionsClient`](Prisma__ai_telemetry_versionsClient.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_telemetry_versions
const ai_telemetry_versions = await prisma.ai_telemetry_versions.findUnique({
  where: {
    // ... provide filter here
  }
})
```

***

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`\>(`args`): [`Prisma__ai_telemetry_versionsClient`](Prisma__ai_telemetry_versionsClient.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:7993

Find one Ai_telemetry_versions that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_versionsFindUniqueOrThrowArgs`](../type-aliases/ai_telemetry_versionsFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_versionsFindUniqueOrThrowArgs`](../type-aliases/ai_telemetry_versionsFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_telemetry_versions

#### Returns

[`Prisma__ai_telemetry_versionsClient`](Prisma__ai_telemetry_versionsClient.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_telemetry_versions
const ai_telemetry_versions = await prisma.ai_telemetry_versions.findUniqueOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`\>(`args`): `object` *extends* `InputErrors` ? [`GetAi_telemetry_versionsGroupByPayload`](../type-aliases/GetAi_telemetry_versionsGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

Defined in: generated/prisma/index.d.ts:8277

Group by Ai_telemetry_versions.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_versionsGroupByArgs`](../type-aliases/ai_telemetry_versionsGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` *extends* `0` \| `1`

##### OrderByArg

`OrderByArg` *extends* \{ `orderBy`: [`ai_telemetry_versionsOrderByWithAggregationInput`](../type-aliases/ai_telemetry_versionsOrderByWithAggregationInput.md) \| [`ai_telemetry_versionsOrderByWithAggregationInput`](../type-aliases/ai_telemetry_versionsOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`ai_telemetry_versionsOrderByWithAggregationInput`](../type-aliases/ai_telemetry_versionsOrderByWithAggregationInput.md) \| [`ai_telemetry_versionsOrderByWithAggregationInput`](../type-aliases/ai_telemetry_versionsOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` *extends* `"id"` \| `"version"` \| `"createdAt"` \| `"componentType"` \| `"description"` \| `"schemaVersion"` \| `"isActive"` \| `"appliedFrom"`

##### ByFields

`ByFields` *extends* [`Ai_telemetry_versionsScalarFieldEnum`](../type-aliases/Ai_telemetry_versionsScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof ai\_telemetry\_versionsGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` *extends* `InputErrors` ? [`GetAi_telemetry_versionsGroupByPayload`](../type-aliases/GetAi_telemetry_versionsGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`\>(`args`): [`Prisma__ai_telemetry_versionsClient`](Prisma__ai_telemetry_versionsClient.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:8125

Update one Ai_telemetry_versions.

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_versionsUpdateArgs`](../type-aliases/ai_telemetry_versionsUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_versionsUpdateArgs`](../type-aliases/ai_telemetry_versionsUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Ai_telemetry_versions.

#### Returns

[`Prisma__ai_telemetry_versionsClient`](Prisma__ai_telemetry_versionsClient.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Ai_telemetry_versions
const ai_telemetry_versions = await prisma.ai_telemetry_versions.update({
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

Defined in: generated/prisma/index.d.ts:8158

Update zero or more Ai_telemetry_versions.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_versionsUpdateManyArgs`](../type-aliases/ai_telemetry_versionsUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_versionsUpdateManyArgs`](../type-aliases/ai_telemetry_versionsUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Ai_telemetry_versions
const ai_telemetry_versions = await prisma.ai_telemetry_versions.updateMany({
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

> **updateManyAndReturn**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:8188

Update zero or more Ai_telemetry_versions and returns the data updated in the database.

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_versionsUpdateManyAndReturnArgs`](../type-aliases/ai_telemetry_versionsUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_versionsUpdateManyAndReturnArgs`](../type-aliases/ai_telemetry_versionsUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Ai_telemetry_versions.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Ai_telemetry_versions
const ai_telemetry_versions = await prisma.ai_telemetry_versions.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Ai_telemetry_versions and only return the `id`
const ai_telemetry_versionsWithIdOnly = await prisma.ai_telemetry_versions.updateManyAndReturn({
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

> **upsert**\<`T`\>(`args`): [`Prisma__ai_telemetry_versionsClient`](Prisma__ai_telemetry_versionsClient.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:8207

Create or update one Ai_telemetry_versions.

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_versionsUpsertArgs`](../type-aliases/ai_telemetry_versionsUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_versionsUpsertArgs`](../type-aliases/ai_telemetry_versionsUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Ai_telemetry_versions.

#### Returns

[`Prisma__ai_telemetry_versionsClient`](Prisma__ai_telemetry_versionsClient.md)\<`GetFindResult`\<[`$ai_telemetry_versionsPayload`](../type-aliases/$ai_telemetry_versionsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Ai_telemetry_versions
const ai_telemetry_versions = await prisma.ai_telemetry_versions.upsert({
  create: {
    // ... data to create a Ai_telemetry_versions
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the Ai_telemetry_versions we want to update
  }
})
```
