[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_transition\_snapshotsDelegate

# Interface: ai\_transition\_snapshotsDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:11524

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`ai_transition_snapshotsFieldRefs`](ai_transition_snapshotsFieldRefs.md)

Defined in: generated/prisma/index.d.ts:11896

Fields of the ai_transition_snapshots model

## Methods

### aggregate()

> **aggregate**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAi_transition_snapshotsAggregateType`](../type-aliases/GetAi_transition_snapshotsAggregateType.md)\<`T`\>\>

Defined in: generated/prisma/index.d.ts:11815

Allows you to perform aggregations operations on a Ai_transition_snapshots.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`Ai_transition_snapshotsAggregateArgs`](../type-aliases/Ai_transition_snapshotsAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`Ai_transition_snapshotsAggregateArgs`](../type-aliases/Ai_transition_snapshotsAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAi_transition_snapshotsAggregateType`](../type-aliases/GetAi_transition_snapshotsAggregateType.md)\<`T`\>\>

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

> **count**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Ai\_transition\_snapshotsCountAggregateOutputType ? Ai\_transition\_snapshotsCountAggregateOutputType\[P\] : never \} : `number`\>

Defined in: generated/prisma/index.d.ts:11781

Count the number of Ai_transition_snapshots.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_transition_snapshotsCountArgs`](../type-aliases/ai_transition_snapshotsCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`ai_transition_snapshotsCountArgs`](../type-aliases/ai_transition_snapshotsCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Ai_transition_snapshots to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Ai\_transition\_snapshotsCountAggregateOutputType ? Ai\_transition\_snapshotsCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Ai_transition_snapshots
const count = await prisma.ai_transition_snapshots.count({
  where: {
    // ... the filter for the Ai_transition_snapshots we want to count
  }
})
```

***

### create()

> **create**\<`T`\>(`args`): [`Prisma__ai_transition_snapshotsClient`](Prisma__ai_transition_snapshotsClient.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:11614

Create a Ai_transition_snapshots.

#### Type Parameters

##### T

`T` *extends* [`ai_transition_snapshotsCreateArgs`](../type-aliases/ai_transition_snapshotsCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_transition_snapshotsCreateArgs`](../type-aliases/ai_transition_snapshotsCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Ai_transition_snapshots.

#### Returns

[`Prisma__ai_transition_snapshotsClient`](Prisma__ai_transition_snapshotsClient.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Ai_transition_snapshots
const Ai_transition_snapshots = await prisma.ai_transition_snapshots.create({
  data: {
    // ... data to create a Ai_transition_snapshots
  }
})
```

***

### createMany()

> **createMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:11628

Create many Ai_transition_snapshots.

#### Type Parameters

##### T

`T` *extends* [`ai_transition_snapshotsCreateManyArgs`](../type-aliases/ai_transition_snapshotsCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_transition_snapshotsCreateManyArgs`](../type-aliases/ai_transition_snapshotsCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Ai_transition_snapshots.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Ai_transition_snapshots
const ai_transition_snapshots = await prisma.ai_transition_snapshots.createMany({
  data: [
    // ... provide data here
  ]
})
```

***

### createManyAndReturn()

> **createManyAndReturn**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:11652

Create many Ai_transition_snapshots and returns the data saved in the database.

#### Type Parameters

##### T

`T` *extends* [`ai_transition_snapshotsCreateManyAndReturnArgs`](../type-aliases/ai_transition_snapshotsCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_transition_snapshotsCreateManyAndReturnArgs`](../type-aliases/ai_transition_snapshotsCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Ai_transition_snapshots.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Ai_transition_snapshots
const ai_transition_snapshots = await prisma.ai_transition_snapshots.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Ai_transition_snapshots and only return the `id`
const ai_transition_snapshotsWithIdOnly = await prisma.ai_transition_snapshots.createManyAndReturn({
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

> **delete**\<`T`\>(`args`): [`Prisma__ai_transition_snapshotsClient`](Prisma__ai_transition_snapshotsClient.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:11666

Delete a Ai_transition_snapshots.

#### Type Parameters

##### T

`T` *extends* [`ai_transition_snapshotsDeleteArgs`](../type-aliases/ai_transition_snapshotsDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_transition_snapshotsDeleteArgs`](../type-aliases/ai_transition_snapshotsDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Ai_transition_snapshots.

#### Returns

[`Prisma__ai_transition_snapshotsClient`](Prisma__ai_transition_snapshotsClient.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Ai_transition_snapshots
const Ai_transition_snapshots = await prisma.ai_transition_snapshots.delete({
  where: {
    // ... filter to delete one Ai_transition_snapshots
  }
})
```

***

### deleteMany()

> **deleteMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:11697

Delete zero or more Ai_transition_snapshots.

#### Type Parameters

##### T

`T` *extends* [`ai_transition_snapshotsDeleteManyArgs`](../type-aliases/ai_transition_snapshotsDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_transition_snapshotsDeleteManyArgs`](../type-aliases/ai_transition_snapshotsDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Ai_transition_snapshots to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Ai_transition_snapshots
const { count } = await prisma.ai_transition_snapshots.deleteMany({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirst()

> **findFirst**\<`T`\>(`args?`): [`Prisma__ai_transition_snapshotsClient`](Prisma__ai_transition_snapshotsClient.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:11566

Find the first Ai_transition_snapshots that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_transition_snapshotsFindFirstArgs`](../type-aliases/ai_transition_snapshotsFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_transition_snapshotsFindFirstArgs`](../type-aliases/ai_transition_snapshotsFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_transition_snapshots

#### Returns

[`Prisma__ai_transition_snapshotsClient`](Prisma__ai_transition_snapshotsClient.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_transition_snapshots
const ai_transition_snapshots = await prisma.ai_transition_snapshots.findFirst({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`\>(`args?`): [`Prisma__ai_transition_snapshotsClient`](Prisma__ai_transition_snapshotsClient.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:11582

Find the first Ai_transition_snapshots that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_transition_snapshotsFindFirstOrThrowArgs`](../type-aliases/ai_transition_snapshotsFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_transition_snapshotsFindFirstOrThrowArgs`](../type-aliases/ai_transition_snapshotsFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_transition_snapshots

#### Returns

[`Prisma__ai_transition_snapshotsClient`](Prisma__ai_transition_snapshotsClient.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_transition_snapshots
const ai_transition_snapshots = await prisma.ai_transition_snapshots.findFirstOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### findMany()

> **findMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:11600

Find zero or more Ai_transition_snapshots that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_transition_snapshotsFindManyArgs`](../type-aliases/ai_transition_snapshotsFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_transition_snapshotsFindManyArgs`](../type-aliases/ai_transition_snapshotsFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Ai_transition_snapshots
const ai_transition_snapshots = await prisma.ai_transition_snapshots.findMany()

// Get first 10 Ai_transition_snapshots
const ai_transition_snapshots = await prisma.ai_transition_snapshots.findMany({ take: 10 })

// Only select the `id`
const ai_transition_snapshotsWithIdOnly = await prisma.ai_transition_snapshots.findMany({ select: { id: true } })
```

***

### findUnique()

> **findUnique**\<`T`\>(`args`): [`Prisma__ai_transition_snapshotsClient`](Prisma__ai_transition_snapshotsClient.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:11537

Find zero or one Ai_transition_snapshots that matches the filter.

#### Type Parameters

##### T

`T` *extends* [`ai_transition_snapshotsFindUniqueArgs`](../type-aliases/ai_transition_snapshotsFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_transition_snapshotsFindUniqueArgs`](../type-aliases/ai_transition_snapshotsFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_transition_snapshots

#### Returns

[`Prisma__ai_transition_snapshotsClient`](Prisma__ai_transition_snapshotsClient.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_transition_snapshots
const ai_transition_snapshots = await prisma.ai_transition_snapshots.findUnique({
  where: {
    // ... provide filter here
  }
})
```

***

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`\>(`args`): [`Prisma__ai_transition_snapshotsClient`](Prisma__ai_transition_snapshotsClient.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:11551

Find one Ai_transition_snapshots that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` *extends* [`ai_transition_snapshotsFindUniqueOrThrowArgs`](../type-aliases/ai_transition_snapshotsFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_transition_snapshotsFindUniqueOrThrowArgs`](../type-aliases/ai_transition_snapshotsFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_transition_snapshots

#### Returns

[`Prisma__ai_transition_snapshotsClient`](Prisma__ai_transition_snapshotsClient.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_transition_snapshots
const ai_transition_snapshots = await prisma.ai_transition_snapshots.findUniqueOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`\>(`args`): `object` *extends* `InputErrors` ? [`GetAi_transition_snapshotsGroupByPayload`](../type-aliases/GetAi_transition_snapshotsGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

Defined in: generated/prisma/index.d.ts:11835

Group by Ai_transition_snapshots.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_transition_snapshotsGroupByArgs`](../type-aliases/ai_transition_snapshotsGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` *extends* `0` \| `1`

##### OrderByArg

`OrderByArg` *extends* \{ `orderBy`: [`ai_transition_snapshotsOrderByWithAggregationInput`](../type-aliases/ai_transition_snapshotsOrderByWithAggregationInput.md) \| [`ai_transition_snapshotsOrderByWithAggregationInput`](../type-aliases/ai_transition_snapshotsOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`ai_transition_snapshotsOrderByWithAggregationInput`](../type-aliases/ai_transition_snapshotsOrderByWithAggregationInput.md) \| [`ai_transition_snapshotsOrderByWithAggregationInput`](../type-aliases/ai_transition_snapshotsOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` *extends* `"id"` \| `"createdAt"` \| `"dn"` \| `"wellId"` \| `"position"` \| `"transitionNo"` \| `"transitionType"` \| `"producer"` \| `"heightFromBottomMm"` \| `"angleDeg"` \| `"collided"` \| `"affectedDennicaHeight"` \| `"affectedRingSelection"` \| `"affectedReductionChoice"` \| `"affectedFinalConfig"` \| `"configId"` \| `"minimalDennicaForTransitionsMm"` \| `"solverModifiedForTransitions"`

##### ByFields

`ByFields` *extends* [`Ai_transition_snapshotsScalarFieldEnum`](../type-aliases/Ai_transition_snapshotsScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof ai\_transition\_snapshotsGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` *extends* `InputErrors` ? [`GetAi_transition_snapshotsGroupByPayload`](../type-aliases/GetAi_transition_snapshotsGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`\>(`args`): [`Prisma__ai_transition_snapshotsClient`](Prisma__ai_transition_snapshotsClient.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:11683

Update one Ai_transition_snapshots.

#### Type Parameters

##### T

`T` *extends* [`ai_transition_snapshotsUpdateArgs`](../type-aliases/ai_transition_snapshotsUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_transition_snapshotsUpdateArgs`](../type-aliases/ai_transition_snapshotsUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Ai_transition_snapshots.

#### Returns

[`Prisma__ai_transition_snapshotsClient`](Prisma__ai_transition_snapshotsClient.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Ai_transition_snapshots
const ai_transition_snapshots = await prisma.ai_transition_snapshots.update({
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

Defined in: generated/prisma/index.d.ts:11716

Update zero or more Ai_transition_snapshots.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_transition_snapshotsUpdateManyArgs`](../type-aliases/ai_transition_snapshotsUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_transition_snapshotsUpdateManyArgs`](../type-aliases/ai_transition_snapshotsUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Ai_transition_snapshots
const ai_transition_snapshots = await prisma.ai_transition_snapshots.updateMany({
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

> **updateManyAndReturn**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:11746

Update zero or more Ai_transition_snapshots and returns the data updated in the database.

#### Type Parameters

##### T

`T` *extends* [`ai_transition_snapshotsUpdateManyAndReturnArgs`](../type-aliases/ai_transition_snapshotsUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_transition_snapshotsUpdateManyAndReturnArgs`](../type-aliases/ai_transition_snapshotsUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Ai_transition_snapshots.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Ai_transition_snapshots
const ai_transition_snapshots = await prisma.ai_transition_snapshots.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Ai_transition_snapshots and only return the `id`
const ai_transition_snapshotsWithIdOnly = await prisma.ai_transition_snapshots.updateManyAndReturn({
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

> **upsert**\<`T`\>(`args`): [`Prisma__ai_transition_snapshotsClient`](Prisma__ai_transition_snapshotsClient.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:11765

Create or update one Ai_transition_snapshots.

#### Type Parameters

##### T

`T` *extends* [`ai_transition_snapshotsUpsertArgs`](../type-aliases/ai_transition_snapshotsUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_transition_snapshotsUpsertArgs`](../type-aliases/ai_transition_snapshotsUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Ai_transition_snapshots.

#### Returns

[`Prisma__ai_transition_snapshotsClient`](Prisma__ai_transition_snapshotsClient.md)\<`GetFindResult`\<[`$ai_transition_snapshotsPayload`](../type-aliases/$ai_transition_snapshotsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Ai_transition_snapshots
const ai_transition_snapshots = await prisma.ai_transition_snapshots.upsert({
  create: {
    // ... data to create a Ai_transition_snapshots
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the Ai_transition_snapshots we want to update
  }
})
```
