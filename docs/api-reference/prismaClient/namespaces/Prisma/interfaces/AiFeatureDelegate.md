[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiFeatureDelegate

# Interface: AiFeatureDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:33183

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`AiFeatureFieldRefs`](AiFeatureFieldRefs.md)

Defined in: generated/prisma/index.d.ts:33555

Fields of the AiFeature model

## Methods

### aggregate()

> **aggregate**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAiFeatureAggregateType`](../type-aliases/GetAiFeatureAggregateType.md)\<`T`\>\>

Defined in: generated/prisma/index.d.ts:33474

Allows you to perform aggregations operations on a AiFeature.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`AiFeatureAggregateArgs`](../type-aliases/AiFeatureAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`AiFeatureAggregateArgs`](../type-aliases/AiFeatureAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAiFeatureAggregateType`](../type-aliases/GetAiFeatureAggregateType.md)\<`T`\>\>

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

> **count**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof AiFeatureCountAggregateOutputType ? AiFeatureCountAggregateOutputType\[P\] : never \} : `number`\>

Defined in: generated/prisma/index.d.ts:33440

Count the number of AiFeatures.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`AiFeatureCountArgs`](../type-aliases/AiFeatureCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`AiFeatureCountArgs`](../type-aliases/AiFeatureCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter AiFeatures to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof AiFeatureCountAggregateOutputType ? AiFeatureCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of AiFeatures
const count = await prisma.aiFeature.count({
  where: {
    // ... the filter for the AiFeatures we want to count
  }
})
```

***

### create()

> **create**\<`T`\>(`args`): [`Prisma__AiFeatureClient`](Prisma__AiFeatureClient.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:33273

Create a AiFeature.

#### Type Parameters

##### T

`T` *extends* [`AiFeatureCreateArgs`](../type-aliases/AiFeatureCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiFeatureCreateArgs`](../type-aliases/AiFeatureCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a AiFeature.

#### Returns

[`Prisma__AiFeatureClient`](Prisma__AiFeatureClient.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one AiFeature
const AiFeature = await prisma.aiFeature.create({
  data: {
    // ... data to create a AiFeature
  }
})
```

***

### createMany()

> **createMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:33287

Create many AiFeatures.

#### Type Parameters

##### T

`T` *extends* [`AiFeatureCreateManyArgs`](../type-aliases/AiFeatureCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiFeatureCreateManyArgs`](../type-aliases/AiFeatureCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many AiFeatures.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many AiFeatures
const aiFeature = await prisma.aiFeature.createMany({
  data: [
    // ... provide data here
  ]
})
```

***

### createManyAndReturn()

> **createManyAndReturn**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:33311

Create many AiFeatures and returns the data saved in the database.

#### Type Parameters

##### T

`T` *extends* [`AiFeatureCreateManyAndReturnArgs`](../type-aliases/AiFeatureCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiFeatureCreateManyAndReturnArgs`](../type-aliases/AiFeatureCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many AiFeatures.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many AiFeatures
const aiFeature = await prisma.aiFeature.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many AiFeatures and only return the `id`
const aiFeatureWithIdOnly = await prisma.aiFeature.createManyAndReturn({
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

> **delete**\<`T`\>(`args`): [`Prisma__AiFeatureClient`](Prisma__AiFeatureClient.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:33325

Delete a AiFeature.

#### Type Parameters

##### T

`T` *extends* [`AiFeatureDeleteArgs`](../type-aliases/AiFeatureDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiFeatureDeleteArgs`](../type-aliases/AiFeatureDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one AiFeature.

#### Returns

[`Prisma__AiFeatureClient`](Prisma__AiFeatureClient.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one AiFeature
const AiFeature = await prisma.aiFeature.delete({
  where: {
    // ... filter to delete one AiFeature
  }
})
```

***

### deleteMany()

> **deleteMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:33356

Delete zero or more AiFeatures.

#### Type Parameters

##### T

`T` *extends* [`AiFeatureDeleteManyArgs`](../type-aliases/AiFeatureDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiFeatureDeleteManyArgs`](../type-aliases/AiFeatureDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter AiFeatures to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few AiFeatures
const { count } = await prisma.aiFeature.deleteMany({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirst()

> **findFirst**\<`T`\>(`args?`): [`Prisma__AiFeatureClient`](Prisma__AiFeatureClient.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:33225

Find the first AiFeature that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`AiFeatureFindFirstArgs`](../type-aliases/AiFeatureFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiFeatureFindFirstArgs`](../type-aliases/AiFeatureFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a AiFeature

#### Returns

[`Prisma__AiFeatureClient`](Prisma__AiFeatureClient.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one AiFeature
const aiFeature = await prisma.aiFeature.findFirst({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`\>(`args?`): [`Prisma__AiFeatureClient`](Prisma__AiFeatureClient.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:33241

Find the first AiFeature that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`AiFeatureFindFirstOrThrowArgs`](../type-aliases/AiFeatureFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiFeatureFindFirstOrThrowArgs`](../type-aliases/AiFeatureFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a AiFeature

#### Returns

[`Prisma__AiFeatureClient`](Prisma__AiFeatureClient.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one AiFeature
const aiFeature = await prisma.aiFeature.findFirstOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### findMany()

> **findMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:33259

Find zero or more AiFeatures that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`AiFeatureFindManyArgs`](../type-aliases/AiFeatureFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiFeatureFindManyArgs`](../type-aliases/AiFeatureFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all AiFeatures
const aiFeatures = await prisma.aiFeature.findMany()

// Get first 10 AiFeatures
const aiFeatures = await prisma.aiFeature.findMany({ take: 10 })

// Only select the `id`
const aiFeatureWithIdOnly = await prisma.aiFeature.findMany({ select: { id: true } })
```

***

### findUnique()

> **findUnique**\<`T`\>(`args`): [`Prisma__AiFeatureClient`](Prisma__AiFeatureClient.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:33196

Find zero or one AiFeature that matches the filter.

#### Type Parameters

##### T

`T` *extends* [`AiFeatureFindUniqueArgs`](../type-aliases/AiFeatureFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiFeatureFindUniqueArgs`](../type-aliases/AiFeatureFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a AiFeature

#### Returns

[`Prisma__AiFeatureClient`](Prisma__AiFeatureClient.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one AiFeature
const aiFeature = await prisma.aiFeature.findUnique({
  where: {
    // ... provide filter here
  }
})
```

***

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`\>(`args`): [`Prisma__AiFeatureClient`](Prisma__AiFeatureClient.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:33210

Find one AiFeature that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` *extends* [`AiFeatureFindUniqueOrThrowArgs`](../type-aliases/AiFeatureFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiFeatureFindUniqueOrThrowArgs`](../type-aliases/AiFeatureFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a AiFeature

#### Returns

[`Prisma__AiFeatureClient`](Prisma__AiFeatureClient.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one AiFeature
const aiFeature = await prisma.aiFeature.findUniqueOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`\>(`args`): `object` *extends* `InputErrors` ? [`GetAiFeatureGroupByPayload`](../type-aliases/GetAiFeatureGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

Defined in: generated/prisma/index.d.ts:33494

Group by AiFeature.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`AiFeatureGroupByArgs`](../type-aliases/AiFeatureGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` *extends* `0` \| `1`

##### OrderByArg

`OrderByArg` *extends* \{ `orderBy`: [`AiFeatureOrderByWithAggregationInput`](../type-aliases/AiFeatureOrderByWithAggregationInput.md) \| [`AiFeatureOrderByWithAggregationInput`](../type-aliases/AiFeatureOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`AiFeatureOrderByWithAggregationInput`](../type-aliases/AiFeatureOrderByWithAggregationInput.md) \| [`AiFeatureOrderByWithAggregationInput`](../type-aliases/AiFeatureOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` *extends* `"id"` \| `"createdAt"` \| `"telemetryId"` \| `"dn"` \| `"heightMm"` \| `"warehouse"` \| `"wellType"` \| `"hasReduction"` \| `"hasPsiaBuda"` \| `"hasStyczna"` \| `"ringCount"` \| `"bottomType"` \| `"topType"` \| `"connectionCount"` \| `"transitionsAboveDennica"` \| `"totalPrice"` \| `"totalWeight"` \| `"ringVariety"` \| `"season"` \| `"label"` \| `"reward"` \| `"decisionMs"`

##### ByFields

`ByFields` *extends* [`AiFeatureScalarFieldEnum`](../type-aliases/AiFeatureScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof AiFeatureGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` *extends* `InputErrors` ? [`GetAiFeatureGroupByPayload`](../type-aliases/GetAiFeatureGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`\>(`args`): [`Prisma__AiFeatureClient`](Prisma__AiFeatureClient.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:33342

Update one AiFeature.

#### Type Parameters

##### T

`T` *extends* [`AiFeatureUpdateArgs`](../type-aliases/AiFeatureUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiFeatureUpdateArgs`](../type-aliases/AiFeatureUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one AiFeature.

#### Returns

[`Prisma__AiFeatureClient`](Prisma__AiFeatureClient.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one AiFeature
const aiFeature = await prisma.aiFeature.update({
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

Defined in: generated/prisma/index.d.ts:33375

Update zero or more AiFeatures.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`AiFeatureUpdateManyArgs`](../type-aliases/AiFeatureUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiFeatureUpdateManyArgs`](../type-aliases/AiFeatureUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many AiFeatures
const aiFeature = await prisma.aiFeature.updateMany({
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

> **updateManyAndReturn**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:33405

Update zero or more AiFeatures and returns the data updated in the database.

#### Type Parameters

##### T

`T` *extends* [`AiFeatureUpdateManyAndReturnArgs`](../type-aliases/AiFeatureUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiFeatureUpdateManyAndReturnArgs`](../type-aliases/AiFeatureUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many AiFeatures.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many AiFeatures
const aiFeature = await prisma.aiFeature.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more AiFeatures and only return the `id`
const aiFeatureWithIdOnly = await prisma.aiFeature.updateManyAndReturn({
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

> **upsert**\<`T`\>(`args`): [`Prisma__AiFeatureClient`](Prisma__AiFeatureClient.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:33424

Create or update one AiFeature.

#### Type Parameters

##### T

`T` *extends* [`AiFeatureUpsertArgs`](../type-aliases/AiFeatureUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiFeatureUpsertArgs`](../type-aliases/AiFeatureUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a AiFeature.

#### Returns

[`Prisma__AiFeatureClient`](Prisma__AiFeatureClient.md)\<`GetFindResult`\<[`$AiFeaturePayload`](../type-aliases/$AiFeaturePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a AiFeature
const aiFeature = await prisma.aiFeature.upsert({
  create: {
    // ... data to create a AiFeature
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the AiFeature we want to update
  }
})
```
