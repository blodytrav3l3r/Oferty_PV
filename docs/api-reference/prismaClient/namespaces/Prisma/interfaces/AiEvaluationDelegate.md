[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / AiEvaluationDelegate

# Interface: AiEvaluationDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:35385

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`AiEvaluationFieldRefs`](AiEvaluationFieldRefs.md)

Defined in: generated/prisma/index.d.ts:35757

Fields of the AiEvaluation model

## Methods

### aggregate()

> **aggregate**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAiEvaluationAggregateType`](../type-aliases/GetAiEvaluationAggregateType.md)\<`T`>>\>\>

Defined in: generated/prisma/index.d.ts:35676

Allows you to perform aggregations operations on a AiEvaluation.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`AiEvaluationAggregateArgs`](../type-aliases/AiEvaluationAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`AiEvaluationAggregateArgs`](../type-aliases/AiEvaluationAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAiEvaluationAggregateType`](../type-aliases/GetAiEvaluationAggregateType.md)\<`T`\>\>

#### Example

```ts
// Ordered by age ascending
// Where email contains prisma.io
// Limited to the 10 users
const aggregations = await prisma.user.aggregate({
    _avg: {
        age: true
    },
    where: {
        email: {
            contains: 'prisma.io'
        }
    },
    orderBy: {
        age: 'asc'
    },
    take: 10
});
```

---

### count()

> **count**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`> \> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof AiEvaluationCountAggregateOutputType ? AiEvaluationCountAggregateOutputType\[P\] : never \} : `number`>\>

Defined in: generated/prisma/index.d.ts:35642

Count the number of AiEvaluations.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`AiEvaluationCountArgs`](../type-aliases/AiEvaluationCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`AiEvaluationCountArgs`](../type-aliases/AiEvaluationCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter AiEvaluations to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof AiEvaluationCountAggregateOutputType ? AiEvaluationCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of AiEvaluations
const count = await prisma.aiEvaluation.count({
    where: {
        // ... the filter for the AiEvaluations we want to count
    }
});
```

---

### create()

> **create**\<`T`>\>(`args`): [`Prisma__AiEvaluationClient`](Prisma__AiEvaluationClient.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:35475

Create a AiEvaluation.

#### Type Parameters

##### T

`T` _extends_ [`AiEvaluationCreateArgs`](../type-aliases/AiEvaluationCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiEvaluationCreateArgs`](../type-aliases/AiEvaluationCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a AiEvaluation.

#### Returns

[`Prisma__AiEvaluationClient`](Prisma__AiEvaluationClient.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one AiEvaluation
const AiEvaluation = await prisma.aiEvaluation.create({
    data: {
        // ... data to create a AiEvaluation
    }
});
```

---

### createMany()

> **createMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:35489

Create many AiEvaluations.

#### Type Parameters

##### T

`T` _extends_ [`AiEvaluationCreateManyArgs`](../type-aliases/AiEvaluationCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiEvaluationCreateManyArgs`](../type-aliases/AiEvaluationCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many AiEvaluations.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many AiEvaluations
const aiEvaluation = await prisma.aiEvaluation.createMany({
    data: [
        // ... provide data here
    ]
});
```

---

### createManyAndReturn()

> **createManyAndReturn**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:35513

Create many AiEvaluations and returns the data saved in the database.

#### Type Parameters

##### T

`T` _extends_ [`AiEvaluationCreateManyAndReturnArgs`](../type-aliases/AiEvaluationCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiEvaluationCreateManyAndReturnArgs`](../type-aliases/AiEvaluationCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many AiEvaluations.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many AiEvaluations
const aiEvaluation = await prisma.aiEvaluation.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many AiEvaluations and only return the `id`
const aiEvaluationWithIdOnly = await prisma.aiEvaluation.createManyAndReturn({
  select: { id: true },
  data: [
    // ... provide data here
  ]
})
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined
```

---

### delete()

> **delete**\<`T`>\>(`args`): [`Prisma__AiEvaluationClient`](Prisma__AiEvaluationClient.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:35527

Delete a AiEvaluation.

#### Type Parameters

##### T

`T` _extends_ [`AiEvaluationDeleteArgs`](../type-aliases/AiEvaluationDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiEvaluationDeleteArgs`](../type-aliases/AiEvaluationDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one AiEvaluation.

#### Returns

[`Prisma__AiEvaluationClient`](Prisma__AiEvaluationClient.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one AiEvaluation
const AiEvaluation = await prisma.aiEvaluation.delete({
    where: {
        // ... filter to delete one AiEvaluation
    }
});
```

---

### deleteMany()

> **deleteMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:35558

Delete zero or more AiEvaluations.

#### Type Parameters

##### T

`T` _extends_ [`AiEvaluationDeleteManyArgs`](../type-aliases/AiEvaluationDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiEvaluationDeleteManyArgs`](../type-aliases/AiEvaluationDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter AiEvaluations to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few AiEvaluations
const { count } = await prisma.aiEvaluation.deleteMany({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirst()

> **findFirst**\<`T`>\>(`args?`): [`Prisma__AiEvaluationClient`](Prisma__AiEvaluationClient.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:35427

Find the first AiEvaluation that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`AiEvaluationFindFirstArgs`](../type-aliases/AiEvaluationFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiEvaluationFindFirstArgs`](../type-aliases/AiEvaluationFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a AiEvaluation

#### Returns

[`Prisma__AiEvaluationClient`](Prisma__AiEvaluationClient.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one AiEvaluation
const aiEvaluation = await prisma.aiEvaluation.findFirst({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`>\>(`args?`): [`Prisma__AiEvaluationClient`](Prisma__AiEvaluationClient.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:35443

Find the first AiEvaluation that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`AiEvaluationFindFirstOrThrowArgs`](../type-aliases/AiEvaluationFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiEvaluationFindFirstOrThrowArgs`](../type-aliases/AiEvaluationFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a AiEvaluation

#### Returns

[`Prisma__AiEvaluationClient`](Prisma__AiEvaluationClient.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one AiEvaluation
const aiEvaluation = await prisma.aiEvaluation.findFirstOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### findMany()

> **findMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:35461

Find zero or more AiEvaluations that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`AiEvaluationFindManyArgs`](../type-aliases/AiEvaluationFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiEvaluationFindManyArgs`](../type-aliases/AiEvaluationFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all AiEvaluations
const aiEvaluations = await prisma.aiEvaluation.findMany();

// Get first 10 AiEvaluations
const aiEvaluations = await prisma.aiEvaluation.findMany({ take: 10 });

// Only select the `id`
const aiEvaluationWithIdOnly = await prisma.aiEvaluation.findMany({ select: { id: true } });
```

---

### findUnique()

> **findUnique**\<`T`>\>(`args`): [`Prisma__AiEvaluationClient`](Prisma__AiEvaluationClient.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:35398

Find zero or one AiEvaluation that matches the filter.

#### Type Parameters

##### T

`T` _extends_ [`AiEvaluationFindUniqueArgs`](../type-aliases/AiEvaluationFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiEvaluationFindUniqueArgs`](../type-aliases/AiEvaluationFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a AiEvaluation

#### Returns

[`Prisma__AiEvaluationClient`](Prisma__AiEvaluationClient.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one AiEvaluation
const aiEvaluation = await prisma.aiEvaluation.findUnique({
    where: {
        // ... provide filter here
    }
});
```

---

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`>\>(`args`): [`Prisma__AiEvaluationClient`](Prisma__AiEvaluationClient.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:35412

Find one AiEvaluation that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` _extends_ [`AiEvaluationFindUniqueOrThrowArgs`](../type-aliases/AiEvaluationFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiEvaluationFindUniqueOrThrowArgs`](../type-aliases/AiEvaluationFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a AiEvaluation

#### Returns

[`Prisma__AiEvaluationClient`](Prisma__AiEvaluationClient.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one AiEvaluation
const aiEvaluation = await prisma.aiEvaluation.findUniqueOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`>\>(`args`): `object` _extends_ `InputErrors` ? [`GetAiEvaluationGroupByPayload`](../type-aliases/GetAiEvaluationGroupByPayload.md)\<`T`> \> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`>\>

Defined in: generated/prisma/index.d.ts:35696

Group by AiEvaluation.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`AiEvaluationGroupByArgs`](../type-aliases/AiEvaluationGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` _extends_ `0` \| `1`

##### OrderByArg

`OrderByArg` _extends_ \{ `orderBy`: [`AiEvaluationOrderByWithAggregationInput`](../type-aliases/AiEvaluationOrderByWithAggregationInput.md) \| [`AiEvaluationOrderByWithAggregationInput`](../type-aliases/AiEvaluationOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`AiEvaluationOrderByWithAggregationInput`](../type-aliases/AiEvaluationOrderByWithAggregationInput.md) \| [`AiEvaluationOrderByWithAggregationInput`](../type-aliases/AiEvaluationOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` _extends_ `"id"` \| `"acceptance"` \| `"modelVersion"` \| `"decisionMsAvg"` \| `"rewardsAvg"` \| `"totalDecisions"` \| `"triggeredAt"`

##### ByFields

`ByFields` _extends_ [`AiEvaluationScalarFieldEnum`](../type-aliases/AiEvaluationScalarFieldEnum.md)

##### ByValid

`ByValid` _extends_ `0` \| `1`

##### HavingFields

`HavingFields` _extends_ `string` \| `number` \| `symbol`

##### HavingValid

`HavingValid`

##### ByEmpty

`ByEmpty` _extends_ `0` \| `1`

##### InputErrors

`InputErrors`

#### Parameters

##### args

\{ \[key in string \| number \| symbol\]: key extends keyof AiEvaluationGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` _extends_ `InputErrors` ? [`GetAiEvaluationGroupByPayload`](../type-aliases/GetAiEvaluationGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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
    }
});
```

---

### update()

> **update**\<`T`>\>(`args`): [`Prisma__AiEvaluationClient`](Prisma__AiEvaluationClient.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:35544

Update one AiEvaluation.

#### Type Parameters

##### T

`T` _extends_ [`AiEvaluationUpdateArgs`](../type-aliases/AiEvaluationUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiEvaluationUpdateArgs`](../type-aliases/AiEvaluationUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one AiEvaluation.

#### Returns

[`Prisma__AiEvaluationClient`](Prisma__AiEvaluationClient.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one AiEvaluation
const aiEvaluation = await prisma.aiEvaluation.update({
    where: {
        // ... provide filter here
    },
    data: {
        // ... provide data here
    }
});
```

---

### updateMany()

> **updateMany**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:35577

Update zero or more AiEvaluations.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`AiEvaluationUpdateManyArgs`](../type-aliases/AiEvaluationUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiEvaluationUpdateManyArgs`](../type-aliases/AiEvaluationUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many AiEvaluations
const aiEvaluation = await prisma.aiEvaluation.updateMany({
    where: {
        // ... provide filter here
    },
    data: {
        // ... provide data here
    }
});
```

---

### updateManyAndReturn()

> **updateManyAndReturn**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:35607

Update zero or more AiEvaluations and returns the data updated in the database.

#### Type Parameters

##### T

`T` _extends_ [`AiEvaluationUpdateManyAndReturnArgs`](../type-aliases/AiEvaluationUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiEvaluationUpdateManyAndReturnArgs`](../type-aliases/AiEvaluationUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many AiEvaluations.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many AiEvaluations
const aiEvaluation = await prisma.aiEvaluation.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more AiEvaluations and only return the `id`
const aiEvaluationWithIdOnly = await prisma.aiEvaluation.updateManyAndReturn({
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

---

### upsert()

> **upsert**\<`T`>\>(`args`): [`Prisma__AiEvaluationClient`](Prisma__AiEvaluationClient.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:35626

Create or update one AiEvaluation.

#### Type Parameters

##### T

`T` _extends_ [`AiEvaluationUpsertArgs`](../type-aliases/AiEvaluationUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`AiEvaluationUpsertArgs`](../type-aliases/AiEvaluationUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a AiEvaluation.

#### Returns

[`Prisma__AiEvaluationClient`](Prisma__AiEvaluationClient.md)\<`GetFindResult`\<[`$AiEvaluationPayload`](../type-aliases/$AiEvaluationPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a AiEvaluation
const aiEvaluation = await prisma.aiEvaluation.upsert({
    create: {
        // ... data to create a AiEvaluation
    },
    update: {
        // ... in case it already exists, update
    },
    where: {
        // ... the filter for the AiEvaluation we want to update
    }
});
```
