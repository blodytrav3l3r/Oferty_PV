[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_telemetry\_logsDelegate

# Interface: ai\_telemetry\_logsDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:4621

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`ai_telemetry_logsFieldRefs`](ai_telemetry_logsFieldRefs.md)

Defined in: generated/prisma/index.d.ts:4993

Fields of the ai_telemetry_logs model

## Methods

### aggregate()

> **aggregate**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAi_telemetry_logsAggregateType`](../type-aliases/GetAi_telemetry_logsAggregateType.md)\<`T`\>\>

Defined in: generated/prisma/index.d.ts:4912

Allows you to perform aggregations operations on a Ai_telemetry_logs.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`Ai_telemetry_logsAggregateArgs`](../type-aliases/Ai_telemetry_logsAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`Ai_telemetry_logsAggregateArgs`](../type-aliases/Ai_telemetry_logsAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAi_telemetry_logsAggregateType`](../type-aliases/GetAi_telemetry_logsAggregateType.md)\<`T`\>\>

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

> **count**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Ai\_telemetry\_logsCountAggregateOutputType ? Ai\_telemetry\_logsCountAggregateOutputType\[P\] : never \} : `number`\>

Defined in: generated/prisma/index.d.ts:4878

Count the number of Ai_telemetry_logs.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_logsCountArgs`](../type-aliases/ai_telemetry_logsCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`ai_telemetry_logsCountArgs`](../type-aliases/ai_telemetry_logsCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Ai_telemetry_logs to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Ai\_telemetry\_logsCountAggregateOutputType ? Ai\_telemetry\_logsCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Ai_telemetry_logs
const count = await prisma.ai_telemetry_logs.count({
  where: {
    // ... the filter for the Ai_telemetry_logs we want to count
  }
})
```

***

### create()

> **create**\<`T`\>(`args`): [`Prisma__ai_telemetry_logsClient`](Prisma__ai_telemetry_logsClient.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:4711

Create a Ai_telemetry_logs.

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_logsCreateArgs`](../type-aliases/ai_telemetry_logsCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_logsCreateArgs`](../type-aliases/ai_telemetry_logsCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Ai_telemetry_logs.

#### Returns

[`Prisma__ai_telemetry_logsClient`](Prisma__ai_telemetry_logsClient.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Ai_telemetry_logs
const Ai_telemetry_logs = await prisma.ai_telemetry_logs.create({
  data: {
    // ... data to create a Ai_telemetry_logs
  }
})
```

***

### createMany()

> **createMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:4725

Create many Ai_telemetry_logs.

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_logsCreateManyArgs`](../type-aliases/ai_telemetry_logsCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_logsCreateManyArgs`](../type-aliases/ai_telemetry_logsCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Ai_telemetry_logs.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Ai_telemetry_logs
const ai_telemetry_logs = await prisma.ai_telemetry_logs.createMany({
  data: [
    // ... provide data here
  ]
})
```

***

### createManyAndReturn()

> **createManyAndReturn**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:4749

Create many Ai_telemetry_logs and returns the data saved in the database.

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_logsCreateManyAndReturnArgs`](../type-aliases/ai_telemetry_logsCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_logsCreateManyAndReturnArgs`](../type-aliases/ai_telemetry_logsCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Ai_telemetry_logs.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Ai_telemetry_logs
const ai_telemetry_logs = await prisma.ai_telemetry_logs.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Ai_telemetry_logs and only return the `id`
const ai_telemetry_logsWithIdOnly = await prisma.ai_telemetry_logs.createManyAndReturn({
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

> **delete**\<`T`\>(`args`): [`Prisma__ai_telemetry_logsClient`](Prisma__ai_telemetry_logsClient.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:4763

Delete a Ai_telemetry_logs.

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_logsDeleteArgs`](../type-aliases/ai_telemetry_logsDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_logsDeleteArgs`](../type-aliases/ai_telemetry_logsDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Ai_telemetry_logs.

#### Returns

[`Prisma__ai_telemetry_logsClient`](Prisma__ai_telemetry_logsClient.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Ai_telemetry_logs
const Ai_telemetry_logs = await prisma.ai_telemetry_logs.delete({
  where: {
    // ... filter to delete one Ai_telemetry_logs
  }
})
```

***

### deleteMany()

> **deleteMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:4794

Delete zero or more Ai_telemetry_logs.

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_logsDeleteManyArgs`](../type-aliases/ai_telemetry_logsDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_logsDeleteManyArgs`](../type-aliases/ai_telemetry_logsDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Ai_telemetry_logs to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Ai_telemetry_logs
const { count } = await prisma.ai_telemetry_logs.deleteMany({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirst()

> **findFirst**\<`T`\>(`args?`): [`Prisma__ai_telemetry_logsClient`](Prisma__ai_telemetry_logsClient.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:4663

Find the first Ai_telemetry_logs that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_logsFindFirstArgs`](../type-aliases/ai_telemetry_logsFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_logsFindFirstArgs`](../type-aliases/ai_telemetry_logsFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_telemetry_logs

#### Returns

[`Prisma__ai_telemetry_logsClient`](Prisma__ai_telemetry_logsClient.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_telemetry_logs
const ai_telemetry_logs = await prisma.ai_telemetry_logs.findFirst({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`\>(`args?`): [`Prisma__ai_telemetry_logsClient`](Prisma__ai_telemetry_logsClient.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:4679

Find the first Ai_telemetry_logs that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_logsFindFirstOrThrowArgs`](../type-aliases/ai_telemetry_logsFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_logsFindFirstOrThrowArgs`](../type-aliases/ai_telemetry_logsFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_telemetry_logs

#### Returns

[`Prisma__ai_telemetry_logsClient`](Prisma__ai_telemetry_logsClient.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_telemetry_logs
const ai_telemetry_logs = await prisma.ai_telemetry_logs.findFirstOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### findMany()

> **findMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:4697

Find zero or more Ai_telemetry_logs that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_logsFindManyArgs`](../type-aliases/ai_telemetry_logsFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_logsFindManyArgs`](../type-aliases/ai_telemetry_logsFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Ai_telemetry_logs
const ai_telemetry_logs = await prisma.ai_telemetry_logs.findMany()

// Get first 10 Ai_telemetry_logs
const ai_telemetry_logs = await prisma.ai_telemetry_logs.findMany({ take: 10 })

// Only select the `id`
const ai_telemetry_logsWithIdOnly = await prisma.ai_telemetry_logs.findMany({ select: { id: true } })
```

***

### findUnique()

> **findUnique**\<`T`\>(`args`): [`Prisma__ai_telemetry_logsClient`](Prisma__ai_telemetry_logsClient.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:4634

Find zero or one Ai_telemetry_logs that matches the filter.

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_logsFindUniqueArgs`](../type-aliases/ai_telemetry_logsFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_logsFindUniqueArgs`](../type-aliases/ai_telemetry_logsFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_telemetry_logs

#### Returns

[`Prisma__ai_telemetry_logsClient`](Prisma__ai_telemetry_logsClient.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_telemetry_logs
const ai_telemetry_logs = await prisma.ai_telemetry_logs.findUnique({
  where: {
    // ... provide filter here
  }
})
```

***

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`\>(`args`): [`Prisma__ai_telemetry_logsClient`](Prisma__ai_telemetry_logsClient.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:4648

Find one Ai_telemetry_logs that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_logsFindUniqueOrThrowArgs`](../type-aliases/ai_telemetry_logsFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_logsFindUniqueOrThrowArgs`](../type-aliases/ai_telemetry_logsFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_telemetry_logs

#### Returns

[`Prisma__ai_telemetry_logsClient`](Prisma__ai_telemetry_logsClient.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_telemetry_logs
const ai_telemetry_logs = await prisma.ai_telemetry_logs.findUniqueOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`\>(`args`): `object` *extends* `InputErrors` ? [`GetAi_telemetry_logsGroupByPayload`](../type-aliases/GetAi_telemetry_logsGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

Defined in: generated/prisma/index.d.ts:4932

Group by Ai_telemetry_logs.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_logsGroupByArgs`](../type-aliases/ai_telemetry_logsGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` *extends* `0` \| `1`

##### OrderByArg

`OrderByArg` *extends* \{ `orderBy`: [`ai_telemetry_logsOrderByWithAggregationInput`](../type-aliases/ai_telemetry_logsOrderByWithAggregationInput.md) \| [`ai_telemetry_logsOrderByWithAggregationInput`](../type-aliases/ai_telemetry_logsOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`ai_telemetry_logsOrderByWithAggregationInput`](../type-aliases/ai_telemetry_logsOrderByWithAggregationInput.md) \| [`ai_telemetry_logsOrderByWithAggregationInput`](../type-aliases/ai_telemetry_logsOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` *extends* `"id"` \| `"createdAt"` \| `"dn"` \| `"warehouse"` \| `"wellType"` \| `"ringCount"` \| `"userId"` \| `"wellId"` \| `"clientId"` \| `"offerId"` \| `"projectId"` \| `"rzDna"` \| `"rzWlazu"` \| `"wellHeight"` \| `"terminationType"` \| `"reductionType"` \| `"zwiencenieType"` \| `"dennicaType"` \| `"dennicaHeight"` \| `"ringHeights"` \| `"appliedReductions"` \| `"appliedKonus"` \| `"appliedHatches"` \| `"appliedSeals"` \| `"allComponentIds"` \| `"solverSource"` \| `"solverVersion"` \| `"rulesVersion"` \| `"computationMs"` \| `"iterationCount"` \| `"checkedVariants"` \| `"rankingScore"` \| `"selectionReason"` \| `"wasAutoGenerated"` \| `"wasAccepted"` \| `"wasRejected"` \| `"wasModified"` \| `"modificationCount"` \| `"confidenceScore"` \| `"learningWeight"` \| `"configVersion"` \| `"parentConfigId"` \| `"reviewStatus"` \| `"featureSnapshot"` \| `"labelSnapshot"` \| `"predictionSnapshot"` \| `"original_auto_config"` \| `"final_user_config"` \| `"override_reason"` \| `"aiVersion"` \| `"trainingEligible"` \| `"feedbackProcessed"` \| `"rewardValue"` \| `"successRate"` \| `"usageCount"` \| `"lastUsedAt"` \| `"lastAcceptedAt"` \| `"lastRejectedAt"` \| `"manualOverrideFlag"` \| `"extraMeta"`

##### ByFields

`ByFields` *extends* [`Ai_telemetry_logsScalarFieldEnum`](../type-aliases/Ai_telemetry_logsScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof ai\_telemetry\_logsGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` *extends* `InputErrors` ? [`GetAi_telemetry_logsGroupByPayload`](../type-aliases/GetAi_telemetry_logsGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`\>(`args`): [`Prisma__ai_telemetry_logsClient`](Prisma__ai_telemetry_logsClient.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:4780

Update one Ai_telemetry_logs.

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_logsUpdateArgs`](../type-aliases/ai_telemetry_logsUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_logsUpdateArgs`](../type-aliases/ai_telemetry_logsUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Ai_telemetry_logs.

#### Returns

[`Prisma__ai_telemetry_logsClient`](Prisma__ai_telemetry_logsClient.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Ai_telemetry_logs
const ai_telemetry_logs = await prisma.ai_telemetry_logs.update({
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

Defined in: generated/prisma/index.d.ts:4813

Update zero or more Ai_telemetry_logs.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_logsUpdateManyArgs`](../type-aliases/ai_telemetry_logsUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_logsUpdateManyArgs`](../type-aliases/ai_telemetry_logsUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Ai_telemetry_logs
const ai_telemetry_logs = await prisma.ai_telemetry_logs.updateMany({
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

> **updateManyAndReturn**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:4843

Update zero or more Ai_telemetry_logs and returns the data updated in the database.

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_logsUpdateManyAndReturnArgs`](../type-aliases/ai_telemetry_logsUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_logsUpdateManyAndReturnArgs`](../type-aliases/ai_telemetry_logsUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Ai_telemetry_logs.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Ai_telemetry_logs
const ai_telemetry_logs = await prisma.ai_telemetry_logs.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Ai_telemetry_logs and only return the `id`
const ai_telemetry_logsWithIdOnly = await prisma.ai_telemetry_logs.updateManyAndReturn({
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

> **upsert**\<`T`\>(`args`): [`Prisma__ai_telemetry_logsClient`](Prisma__ai_telemetry_logsClient.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:4862

Create or update one Ai_telemetry_logs.

#### Type Parameters

##### T

`T` *extends* [`ai_telemetry_logsUpsertArgs`](../type-aliases/ai_telemetry_logsUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_logsUpsertArgs`](../type-aliases/ai_telemetry_logsUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Ai_telemetry_logs.

#### Returns

[`Prisma__ai_telemetry_logsClient`](Prisma__ai_telemetry_logsClient.md)\<`GetFindResult`\<[`$ai_telemetry_logsPayload`](../type-aliases/$ai_telemetry_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Ai_telemetry_logs
const ai_telemetry_logs = await prisma.ai_telemetry_logs.upsert({
  create: {
    // ... data to create a Ai_telemetry_logs
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the Ai_telemetry_logs we want to update
  }
})
```
