[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiModelDelegate

# Interface: AiModelDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:34315

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`AiModelFieldRefs`](AiModelFieldRefs.md)

Defined in: generated/prisma/index.d.ts:34687

Fields of the AiModel model

## Methods

### aggregate()

> **aggregate**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAiModelAggregateType`](../type-aliases/GetAiModelAggregateType.md)\<`T`\>\>

Defined in: generated/prisma/index.d.ts:34606

Allows you to perform aggregations operations on a AiModel.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`AiModelAggregateArgs`](../type-aliases/AiModelAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`AiModelAggregateArgs`](../type-aliases/AiModelAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAiModelAggregateType`](../type-aliases/GetAiModelAggregateType.md)\<`T`\>\>

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

> **count**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof AiModelCountAggregateOutputType ? AiModelCountAggregateOutputType\[P\] : never \} : `number`\>

Defined in: generated/prisma/index.d.ts:34572

Count the number of AiModels.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`AiModelCountArgs`](../type-aliases/AiModelCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`AiModelCountArgs`](../type-aliases/AiModelCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter AiModels to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof AiModelCountAggregateOutputType ? AiModelCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of AiModels
const count = await prisma.aiModel.count({
  where: {
    // ... the filter for the AiModels we want to count
  }
})
```

***

### create()

> **create**\<`T`\>(`args`): [`Prisma__AiModelClient`](Prisma__AiModelClient.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:34405

Create a AiModel.

#### Type Parameters

##### T

`T` *extends* [`AiModelCreateArgs`](../type-aliases/AiModelCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiModelCreateArgs`](../type-aliases/AiModelCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a AiModel.

#### Returns

[`Prisma__AiModelClient`](Prisma__AiModelClient.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one AiModel
const AiModel = await prisma.aiModel.create({
  data: {
    // ... data to create a AiModel
  }
})
```

***

### createMany()

> **createMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:34419

Create many AiModels.

#### Type Parameters

##### T

`T` *extends* [`AiModelCreateManyArgs`](../type-aliases/AiModelCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiModelCreateManyArgs`](../type-aliases/AiModelCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many AiModels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many AiModels
const aiModel = await prisma.aiModel.createMany({
  data: [
    // ... provide data here
  ]
})
```

***

### createManyAndReturn()

> **createManyAndReturn**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:34443

Create many AiModels and returns the data saved in the database.

#### Type Parameters

##### T

`T` *extends* [`AiModelCreateManyAndReturnArgs`](../type-aliases/AiModelCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiModelCreateManyAndReturnArgs`](../type-aliases/AiModelCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many AiModels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many AiModels
const aiModel = await prisma.aiModel.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many AiModels and only return the `id`
const aiModelWithIdOnly = await prisma.aiModel.createManyAndReturn({
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

> **delete**\<`T`\>(`args`): [`Prisma__AiModelClient`](Prisma__AiModelClient.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:34457

Delete a AiModel.

#### Type Parameters

##### T

`T` *extends* [`AiModelDeleteArgs`](../type-aliases/AiModelDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiModelDeleteArgs`](../type-aliases/AiModelDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one AiModel.

#### Returns

[`Prisma__AiModelClient`](Prisma__AiModelClient.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one AiModel
const AiModel = await prisma.aiModel.delete({
  where: {
    // ... filter to delete one AiModel
  }
})
```

***

### deleteMany()

> **deleteMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:34488

Delete zero or more AiModels.

#### Type Parameters

##### T

`T` *extends* [`AiModelDeleteManyArgs`](../type-aliases/AiModelDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiModelDeleteManyArgs`](../type-aliases/AiModelDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter AiModels to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few AiModels
const { count } = await prisma.aiModel.deleteMany({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirst()

> **findFirst**\<`T`\>(`args?`): [`Prisma__AiModelClient`](Prisma__AiModelClient.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:34357

Find the first AiModel that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`AiModelFindFirstArgs`](../type-aliases/AiModelFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiModelFindFirstArgs`](../type-aliases/AiModelFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a AiModel

#### Returns

[`Prisma__AiModelClient`](Prisma__AiModelClient.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one AiModel
const aiModel = await prisma.aiModel.findFirst({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`\>(`args?`): [`Prisma__AiModelClient`](Prisma__AiModelClient.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:34373

Find the first AiModel that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`AiModelFindFirstOrThrowArgs`](../type-aliases/AiModelFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiModelFindFirstOrThrowArgs`](../type-aliases/AiModelFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a AiModel

#### Returns

[`Prisma__AiModelClient`](Prisma__AiModelClient.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one AiModel
const aiModel = await prisma.aiModel.findFirstOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### findMany()

> **findMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:34391

Find zero or more AiModels that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`AiModelFindManyArgs`](../type-aliases/AiModelFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiModelFindManyArgs`](../type-aliases/AiModelFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all AiModels
const aiModels = await prisma.aiModel.findMany()

// Get first 10 AiModels
const aiModels = await prisma.aiModel.findMany({ take: 10 })

// Only select the `id`
const aiModelWithIdOnly = await prisma.aiModel.findMany({ select: { id: true } })
```

***

### findUnique()

> **findUnique**\<`T`\>(`args`): [`Prisma__AiModelClient`](Prisma__AiModelClient.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:34328

Find zero or one AiModel that matches the filter.

#### Type Parameters

##### T

`T` *extends* [`AiModelFindUniqueArgs`](../type-aliases/AiModelFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiModelFindUniqueArgs`](../type-aliases/AiModelFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a AiModel

#### Returns

[`Prisma__AiModelClient`](Prisma__AiModelClient.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one AiModel
const aiModel = await prisma.aiModel.findUnique({
  where: {
    // ... provide filter here
  }
})
```

***

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`\>(`args`): [`Prisma__AiModelClient`](Prisma__AiModelClient.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:34342

Find one AiModel that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` *extends* [`AiModelFindUniqueOrThrowArgs`](../type-aliases/AiModelFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiModelFindUniqueOrThrowArgs`](../type-aliases/AiModelFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a AiModel

#### Returns

[`Prisma__AiModelClient`](Prisma__AiModelClient.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one AiModel
const aiModel = await prisma.aiModel.findUniqueOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`\>(`args`): `object` *extends* `InputErrors` ? [`GetAiModelGroupByPayload`](../type-aliases/GetAiModelGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

Defined in: generated/prisma/index.d.ts:34626

Group by AiModel.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`AiModelGroupByArgs`](../type-aliases/AiModelGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` *extends* `0` \| `1`

##### OrderByArg

`OrderByArg` *extends* \{ `orderBy`: [`AiModelOrderByWithAggregationInput`](../type-aliases/AiModelOrderByWithAggregationInput.md) \| [`AiModelOrderByWithAggregationInput`](../type-aliases/AiModelOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`AiModelOrderByWithAggregationInput`](../type-aliases/AiModelOrderByWithAggregationInput.md) \| [`AiModelOrderByWithAggregationInput`](../type-aliases/AiModelOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` *extends* `"id"` \| `"version"` \| `"weights"` \| `"bias"` \| `"metrics"` \| `"features"` \| `"featureMins"` \| `"featureMaxs"` \| `"trainingRows"` \| `"active"` \| `"notes"` \| `"createdAt"`

##### ByFields

`ByFields` *extends* [`AiModelScalarFieldEnum`](../type-aliases/AiModelScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof AiModelGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` *extends* `InputErrors` ? [`GetAiModelGroupByPayload`](../type-aliases/GetAiModelGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`\>(`args`): [`Prisma__AiModelClient`](Prisma__AiModelClient.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:34474

Update one AiModel.

#### Type Parameters

##### T

`T` *extends* [`AiModelUpdateArgs`](../type-aliases/AiModelUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiModelUpdateArgs`](../type-aliases/AiModelUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one AiModel.

#### Returns

[`Prisma__AiModelClient`](Prisma__AiModelClient.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one AiModel
const aiModel = await prisma.aiModel.update({
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

Defined in: generated/prisma/index.d.ts:34507

Update zero or more AiModels.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`AiModelUpdateManyArgs`](../type-aliases/AiModelUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiModelUpdateManyArgs`](../type-aliases/AiModelUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many AiModels
const aiModel = await prisma.aiModel.updateMany({
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

> **updateManyAndReturn**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:34537

Update zero or more AiModels and returns the data updated in the database.

#### Type Parameters

##### T

`T` *extends* [`AiModelUpdateManyAndReturnArgs`](../type-aliases/AiModelUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiModelUpdateManyAndReturnArgs`](../type-aliases/AiModelUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many AiModels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many AiModels
const aiModel = await prisma.aiModel.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more AiModels and only return the `id`
const aiModelWithIdOnly = await prisma.aiModel.updateManyAndReturn({
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

> **upsert**\<`T`\>(`args`): [`Prisma__AiModelClient`](Prisma__AiModelClient.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:34556

Create or update one AiModel.

#### Type Parameters

##### T

`T` *extends* [`AiModelUpsertArgs`](../type-aliases/AiModelUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiModelUpsertArgs`](../type-aliases/AiModelUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a AiModel.

#### Returns

[`Prisma__AiModelClient`](Prisma__AiModelClient.md)\<`GetFindResult`\<[`$AiModelPayload`](../type-aliases/$AiModelPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a AiModel
const aiModel = await prisma.aiModel.upsert({
  create: {
    // ... data to create a AiModel
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the AiModel we want to update
  }
})
```
