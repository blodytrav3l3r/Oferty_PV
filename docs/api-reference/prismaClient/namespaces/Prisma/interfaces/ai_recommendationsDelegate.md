[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_recommendationsDelegate

# Interface: ai\_recommendationsDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:10316

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`ai_recommendationsFieldRefs`](ai_recommendationsFieldRefs.md)

Defined in: generated/prisma/index.d.ts:10688

Fields of the ai_recommendations model

## Methods

### aggregate()

> **aggregate**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAi_recommendationsAggregateType`](../type-aliases/GetAi_recommendationsAggregateType.md)\<`T`\>\>

Defined in: generated/prisma/index.d.ts:10607

Allows you to perform aggregations operations on a Ai_recommendations.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`Ai_recommendationsAggregateArgs`](../type-aliases/Ai_recommendationsAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`Ai_recommendationsAggregateArgs`](../type-aliases/Ai_recommendationsAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAi_recommendationsAggregateType`](../type-aliases/GetAi_recommendationsAggregateType.md)\<`T`\>\>

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

> **count**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Ai\_recommendationsCountAggregateOutputType ? Ai\_recommendationsCountAggregateOutputType\[P\] : never \} : `number`\>

Defined in: generated/prisma/index.d.ts:10573

Count the number of Ai_recommendations.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_recommendationsCountArgs`](../type-aliases/ai_recommendationsCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`ai_recommendationsCountArgs`](../type-aliases/ai_recommendationsCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Ai_recommendations to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Ai\_recommendationsCountAggregateOutputType ? Ai\_recommendationsCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Ai_recommendations
const count = await prisma.ai_recommendations.count({
  where: {
    // ... the filter for the Ai_recommendations we want to count
  }
})
```

***

### create()

> **create**\<`T`\>(`args`): [`Prisma__ai_recommendationsClient`](Prisma__ai_recommendationsClient.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:10406

Create a Ai_recommendations.

#### Type Parameters

##### T

`T` *extends* [`ai_recommendationsCreateArgs`](../type-aliases/ai_recommendationsCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_recommendationsCreateArgs`](../type-aliases/ai_recommendationsCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Ai_recommendations.

#### Returns

[`Prisma__ai_recommendationsClient`](Prisma__ai_recommendationsClient.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Ai_recommendations
const Ai_recommendations = await prisma.ai_recommendations.create({
  data: {
    // ... data to create a Ai_recommendations
  }
})
```

***

### createMany()

> **createMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:10420

Create many Ai_recommendations.

#### Type Parameters

##### T

`T` *extends* [`ai_recommendationsCreateManyArgs`](../type-aliases/ai_recommendationsCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_recommendationsCreateManyArgs`](../type-aliases/ai_recommendationsCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Ai_recommendations.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Ai_recommendations
const ai_recommendations = await prisma.ai_recommendations.createMany({
  data: [
    // ... provide data here
  ]
})
```

***

### createManyAndReturn()

> **createManyAndReturn**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:10444

Create many Ai_recommendations and returns the data saved in the database.

#### Type Parameters

##### T

`T` *extends* [`ai_recommendationsCreateManyAndReturnArgs`](../type-aliases/ai_recommendationsCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_recommendationsCreateManyAndReturnArgs`](../type-aliases/ai_recommendationsCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Ai_recommendations.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Ai_recommendations
const ai_recommendations = await prisma.ai_recommendations.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Ai_recommendations and only return the `id`
const ai_recommendationsWithIdOnly = await prisma.ai_recommendations.createManyAndReturn({
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

> **delete**\<`T`\>(`args`): [`Prisma__ai_recommendationsClient`](Prisma__ai_recommendationsClient.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:10458

Delete a Ai_recommendations.

#### Type Parameters

##### T

`T` *extends* [`ai_recommendationsDeleteArgs`](../type-aliases/ai_recommendationsDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_recommendationsDeleteArgs`](../type-aliases/ai_recommendationsDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Ai_recommendations.

#### Returns

[`Prisma__ai_recommendationsClient`](Prisma__ai_recommendationsClient.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Ai_recommendations
const Ai_recommendations = await prisma.ai_recommendations.delete({
  where: {
    // ... filter to delete one Ai_recommendations
  }
})
```

***

### deleteMany()

> **deleteMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:10489

Delete zero or more Ai_recommendations.

#### Type Parameters

##### T

`T` *extends* [`ai_recommendationsDeleteManyArgs`](../type-aliases/ai_recommendationsDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_recommendationsDeleteManyArgs`](../type-aliases/ai_recommendationsDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Ai_recommendations to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Ai_recommendations
const { count } = await prisma.ai_recommendations.deleteMany({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirst()

> **findFirst**\<`T`\>(`args?`): [`Prisma__ai_recommendationsClient`](Prisma__ai_recommendationsClient.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:10358

Find the first Ai_recommendations that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_recommendationsFindFirstArgs`](../type-aliases/ai_recommendationsFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_recommendationsFindFirstArgs`](../type-aliases/ai_recommendationsFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_recommendations

#### Returns

[`Prisma__ai_recommendationsClient`](Prisma__ai_recommendationsClient.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_recommendations
const ai_recommendations = await prisma.ai_recommendations.findFirst({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`\>(`args?`): [`Prisma__ai_recommendationsClient`](Prisma__ai_recommendationsClient.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:10374

Find the first Ai_recommendations that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_recommendationsFindFirstOrThrowArgs`](../type-aliases/ai_recommendationsFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_recommendationsFindFirstOrThrowArgs`](../type-aliases/ai_recommendationsFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_recommendations

#### Returns

[`Prisma__ai_recommendationsClient`](Prisma__ai_recommendationsClient.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_recommendations
const ai_recommendations = await prisma.ai_recommendations.findFirstOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### findMany()

> **findMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:10392

Find zero or more Ai_recommendations that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_recommendationsFindManyArgs`](../type-aliases/ai_recommendationsFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_recommendationsFindManyArgs`](../type-aliases/ai_recommendationsFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Ai_recommendations
const ai_recommendations = await prisma.ai_recommendations.findMany()

// Get first 10 Ai_recommendations
const ai_recommendations = await prisma.ai_recommendations.findMany({ take: 10 })

// Only select the `id`
const ai_recommendationsWithIdOnly = await prisma.ai_recommendations.findMany({ select: { id: true } })
```

***

### findUnique()

> **findUnique**\<`T`\>(`args`): [`Prisma__ai_recommendationsClient`](Prisma__ai_recommendationsClient.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:10329

Find zero or one Ai_recommendations that matches the filter.

#### Type Parameters

##### T

`T` *extends* [`ai_recommendationsFindUniqueArgs`](../type-aliases/ai_recommendationsFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_recommendationsFindUniqueArgs`](../type-aliases/ai_recommendationsFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_recommendations

#### Returns

[`Prisma__ai_recommendationsClient`](Prisma__ai_recommendationsClient.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_recommendations
const ai_recommendations = await prisma.ai_recommendations.findUnique({
  where: {
    // ... provide filter here
  }
})
```

***

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`\>(`args`): [`Prisma__ai_recommendationsClient`](Prisma__ai_recommendationsClient.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:10343

Find one Ai_recommendations that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` *extends* [`ai_recommendationsFindUniqueOrThrowArgs`](../type-aliases/ai_recommendationsFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_recommendationsFindUniqueOrThrowArgs`](../type-aliases/ai_recommendationsFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_recommendations

#### Returns

[`Prisma__ai_recommendationsClient`](Prisma__ai_recommendationsClient.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_recommendations
const ai_recommendations = await prisma.ai_recommendations.findUniqueOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`\>(`args`): `object` *extends* `InputErrors` ? [`GetAi_recommendationsGroupByPayload`](../type-aliases/GetAi_recommendationsGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

Defined in: generated/prisma/index.d.ts:10627

Group by Ai_recommendations.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_recommendationsGroupByArgs`](../type-aliases/ai_recommendationsGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` *extends* `0` \| `1`

##### OrderByArg

`OrderByArg` *extends* \{ `orderBy`: [`ai_recommendationsOrderByWithAggregationInput`](../type-aliases/ai_recommendationsOrderByWithAggregationInput.md) \| [`ai_recommendationsOrderByWithAggregationInput`](../type-aliases/ai_recommendationsOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`ai_recommendationsOrderByWithAggregationInput`](../type-aliases/ai_recommendationsOrderByWithAggregationInput.md) \| [`ai_recommendationsOrderByWithAggregationInput`](../type-aliases/ai_recommendationsOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` *extends* `"id"` \| `"dn"` \| `"wellId"` \| `"wasAccepted"` \| `"wasRejected"` \| `"patternType"` \| `"patternKey"` \| `"confidence"` \| `"score"` \| `"payload"` \| `"wasApplied"` \| `"generatedAt"` \| `"decidedAt"` \| `"decidedBy"`

##### ByFields

`ByFields` *extends* [`Ai_recommendationsScalarFieldEnum`](../type-aliases/Ai_recommendationsScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof ai\_recommendationsGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` *extends* `InputErrors` ? [`GetAi_recommendationsGroupByPayload`](../type-aliases/GetAi_recommendationsGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`\>(`args`): [`Prisma__ai_recommendationsClient`](Prisma__ai_recommendationsClient.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:10475

Update one Ai_recommendations.

#### Type Parameters

##### T

`T` *extends* [`ai_recommendationsUpdateArgs`](../type-aliases/ai_recommendationsUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_recommendationsUpdateArgs`](../type-aliases/ai_recommendationsUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Ai_recommendations.

#### Returns

[`Prisma__ai_recommendationsClient`](Prisma__ai_recommendationsClient.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Ai_recommendations
const ai_recommendations = await prisma.ai_recommendations.update({
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

Defined in: generated/prisma/index.d.ts:10508

Update zero or more Ai_recommendations.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_recommendationsUpdateManyArgs`](../type-aliases/ai_recommendationsUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_recommendationsUpdateManyArgs`](../type-aliases/ai_recommendationsUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Ai_recommendations
const ai_recommendations = await prisma.ai_recommendations.updateMany({
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

> **updateManyAndReturn**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:10538

Update zero or more Ai_recommendations and returns the data updated in the database.

#### Type Parameters

##### T

`T` *extends* [`ai_recommendationsUpdateManyAndReturnArgs`](../type-aliases/ai_recommendationsUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_recommendationsUpdateManyAndReturnArgs`](../type-aliases/ai_recommendationsUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Ai_recommendations.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Ai_recommendations
const ai_recommendations = await prisma.ai_recommendations.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Ai_recommendations and only return the `id`
const ai_recommendationsWithIdOnly = await prisma.ai_recommendations.updateManyAndReturn({
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

> **upsert**\<`T`\>(`args`): [`Prisma__ai_recommendationsClient`](Prisma__ai_recommendationsClient.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:10557

Create or update one Ai_recommendations.

#### Type Parameters

##### T

`T` *extends* [`ai_recommendationsUpsertArgs`](../type-aliases/ai_recommendationsUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_recommendationsUpsertArgs`](../type-aliases/ai_recommendationsUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Ai_recommendations.

#### Returns

[`Prisma__ai_recommendationsClient`](Prisma__ai_recommendationsClient.md)\<`GetFindResult`\<[`$ai_recommendationsPayload`](../type-aliases/$ai_recommendationsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Ai_recommendations
const ai_recommendations = await prisma.ai_recommendations.upsert({
  create: {
    // ... data to create a Ai_recommendations
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the Ai_recommendations we want to update
  }
})
```
