[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_knowledge\_baseDelegate

# Interface: ai\_knowledge\_baseDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:9164

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`ai_knowledge_baseFieldRefs`](ai_knowledge_baseFieldRefs.md)

Defined in: generated/prisma/index.d.ts:9536

Fields of the ai_knowledge_base model

## Methods

### aggregate()

> **aggregate**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAi_knowledge_baseAggregateType`](../type-aliases/GetAi_knowledge_baseAggregateType.md)\<`T`>>\>\>

Defined in: generated/prisma/index.d.ts:9455

Allows you to perform aggregations operations on a Ai_knowledge_base.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`Ai_knowledge_baseAggregateArgs`](../type-aliases/Ai_knowledge_baseAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`Ai_knowledge_baseAggregateArgs`](../type-aliases/Ai_knowledge_baseAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAi_knowledge_baseAggregateType`](../type-aliases/GetAi_knowledge_baseAggregateType.md)\<`T`\>\>

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

> **count**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`> \> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Ai\_knowledge\_baseCountAggregateOutputType ? Ai\_knowledge\_baseCountAggregateOutputType\[P\] : never \} : `number`>\>

Defined in: generated/prisma/index.d.ts:9421

Count the number of Ai_knowledge_bases.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ai_knowledge_baseCountArgs`](../type-aliases/ai_knowledge_baseCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`ai_knowledge_baseCountArgs`](../type-aliases/ai_knowledge_baseCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Ai_knowledge_bases to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Ai\_knowledge\_baseCountAggregateOutputType ? Ai\_knowledge\_baseCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Ai_knowledge_bases
const count = await prisma.ai_knowledge_base.count({
    where: {
        // ... the filter for the Ai_knowledge_bases we want to count
    }
});
```

---

### create()

> **create**\<`T`>\>(`args`): [`Prisma__ai_knowledge_baseClient`](Prisma__ai_knowledge_baseClient.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:9254

Create a Ai_knowledge_base.

#### Type Parameters

##### T

`T` _extends_ [`ai_knowledge_baseCreateArgs`](../type-aliases/ai_knowledge_baseCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_knowledge_baseCreateArgs`](../type-aliases/ai_knowledge_baseCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Ai_knowledge_base.

#### Returns

[`Prisma__ai_knowledge_baseClient`](Prisma__ai_knowledge_baseClient.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Ai_knowledge_base
const Ai_knowledge_base = await prisma.ai_knowledge_base.create({
    data: {
        // ... data to create a Ai_knowledge_base
    }
});
```

---

### createMany()

> **createMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:9268

Create many Ai_knowledge_bases.

#### Type Parameters

##### T

`T` _extends_ [`ai_knowledge_baseCreateManyArgs`](../type-aliases/ai_knowledge_baseCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_knowledge_baseCreateManyArgs`](../type-aliases/ai_knowledge_baseCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Ai_knowledge_bases.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Ai_knowledge_bases
const ai_knowledge_base = await prisma.ai_knowledge_base.createMany({
    data: [
        // ... provide data here
    ]
});
```

---

### createManyAndReturn()

> **createManyAndReturn**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:9292

Create many Ai_knowledge_bases and returns the data saved in the database.

#### Type Parameters

##### T

`T` _extends_ [`ai_knowledge_baseCreateManyAndReturnArgs`](../type-aliases/ai_knowledge_baseCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_knowledge_baseCreateManyAndReturnArgs`](../type-aliases/ai_knowledge_baseCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Ai_knowledge_bases.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Ai_knowledge_bases
const ai_knowledge_base = await prisma.ai_knowledge_base.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Ai_knowledge_bases and only return the `id`
const ai_knowledge_baseWithIdOnly = await prisma.ai_knowledge_base.createManyAndReturn({
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

> **delete**\<`T`>\>(`args`): [`Prisma__ai_knowledge_baseClient`](Prisma__ai_knowledge_baseClient.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:9306

Delete a Ai_knowledge_base.

#### Type Parameters

##### T

`T` _extends_ [`ai_knowledge_baseDeleteArgs`](../type-aliases/ai_knowledge_baseDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_knowledge_baseDeleteArgs`](../type-aliases/ai_knowledge_baseDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Ai_knowledge_base.

#### Returns

[`Prisma__ai_knowledge_baseClient`](Prisma__ai_knowledge_baseClient.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Ai_knowledge_base
const Ai_knowledge_base = await prisma.ai_knowledge_base.delete({
    where: {
        // ... filter to delete one Ai_knowledge_base
    }
});
```

---

### deleteMany()

> **deleteMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:9337

Delete zero or more Ai_knowledge_bases.

#### Type Parameters

##### T

`T` _extends_ [`ai_knowledge_baseDeleteManyArgs`](../type-aliases/ai_knowledge_baseDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_knowledge_baseDeleteManyArgs`](../type-aliases/ai_knowledge_baseDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Ai_knowledge_bases to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Ai_knowledge_bases
const { count } = await prisma.ai_knowledge_base.deleteMany({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirst()

> **findFirst**\<`T`>\>(`args?`): [`Prisma__ai_knowledge_baseClient`](Prisma__ai_knowledge_baseClient.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:9206

Find the first Ai_knowledge_base that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ai_knowledge_baseFindFirstArgs`](../type-aliases/ai_knowledge_baseFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_knowledge_baseFindFirstArgs`](../type-aliases/ai_knowledge_baseFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_knowledge_base

#### Returns

[`Prisma__ai_knowledge_baseClient`](Prisma__ai_knowledge_baseClient.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_knowledge_base
const ai_knowledge_base = await prisma.ai_knowledge_base.findFirst({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`>\>(`args?`): [`Prisma__ai_knowledge_baseClient`](Prisma__ai_knowledge_baseClient.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:9222

Find the first Ai_knowledge_base that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ai_knowledge_baseFindFirstOrThrowArgs`](../type-aliases/ai_knowledge_baseFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_knowledge_baseFindFirstOrThrowArgs`](../type-aliases/ai_knowledge_baseFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_knowledge_base

#### Returns

[`Prisma__ai_knowledge_baseClient`](Prisma__ai_knowledge_baseClient.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_knowledge_base
const ai_knowledge_base = await prisma.ai_knowledge_base.findFirstOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### findMany()

> **findMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:9240

Find zero or more Ai_knowledge_bases that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ai_knowledge_baseFindManyArgs`](../type-aliases/ai_knowledge_baseFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_knowledge_baseFindManyArgs`](../type-aliases/ai_knowledge_baseFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Ai_knowledge_bases
const ai_knowledge_bases = await prisma.ai_knowledge_base.findMany();

// Get first 10 Ai_knowledge_bases
const ai_knowledge_bases = await prisma.ai_knowledge_base.findMany({ take: 10 });

// Only select the `id`
const ai_knowledge_baseWithIdOnly = await prisma.ai_knowledge_base.findMany({
    select: { id: true }
});
```

---

### findUnique()

> **findUnique**\<`T`>\>(`args`): [`Prisma__ai_knowledge_baseClient`](Prisma__ai_knowledge_baseClient.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:9177

Find zero or one Ai_knowledge_base that matches the filter.

#### Type Parameters

##### T

`T` _extends_ [`ai_knowledge_baseFindUniqueArgs`](../type-aliases/ai_knowledge_baseFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_knowledge_baseFindUniqueArgs`](../type-aliases/ai_knowledge_baseFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_knowledge_base

#### Returns

[`Prisma__ai_knowledge_baseClient`](Prisma__ai_knowledge_baseClient.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_knowledge_base
const ai_knowledge_base = await prisma.ai_knowledge_base.findUnique({
    where: {
        // ... provide filter here
    }
});
```

---

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`>\>(`args`): [`Prisma__ai_knowledge_baseClient`](Prisma__ai_knowledge_baseClient.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:9191

Find one Ai_knowledge_base that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` _extends_ [`ai_knowledge_baseFindUniqueOrThrowArgs`](../type-aliases/ai_knowledge_baseFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_knowledge_baseFindUniqueOrThrowArgs`](../type-aliases/ai_knowledge_baseFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_knowledge_base

#### Returns

[`Prisma__ai_knowledge_baseClient`](Prisma__ai_knowledge_baseClient.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_knowledge_base
const ai_knowledge_base = await prisma.ai_knowledge_base.findUniqueOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`>\>(`args`): `object` _extends_ `InputErrors` ? [`GetAi_knowledge_baseGroupByPayload`](../type-aliases/GetAi_knowledge_baseGroupByPayload.md)\<`T`> \> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`>\>

Defined in: generated/prisma/index.d.ts:9475

Group by Ai_knowledge_base.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ai_knowledge_baseGroupByArgs`](../type-aliases/ai_knowledge_baseGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` _extends_ `0` \| `1`

##### OrderByArg

`OrderByArg` _extends_ \{ `orderBy`: [`ai_knowledge_baseOrderByWithAggregationInput`](../type-aliases/ai_knowledge_baseOrderByWithAggregationInput.md) \| [`ai_knowledge_baseOrderByWithAggregationInput`](../type-aliases/ai_knowledge_baseOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`ai_knowledge_baseOrderByWithAggregationInput`](../type-aliases/ai_knowledge_baseOrderByWithAggregationInput.md) \| [`ai_knowledge_baseOrderByWithAggregationInput`](../type-aliases/ai_knowledge_baseOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` _extends_ `"id"` \| `"dn"` \| `"status"` \| `"description"` \| `"schemaVersion"` \| `"patternType"` \| `"patternKey"` \| `"context"` \| `"recommendation"` \| `"hitCount"` \| `"confidence"` \| `"successCount"` \| `"rejectionCount"` \| `"firstDetectedAt"` \| `"lastHitAt"` \| `"lastUpdatedAt"` \| `"changeHistory"` \| `"generatedBy"`

##### ByFields

`ByFields` _extends_ [`Ai_knowledge_baseScalarFieldEnum`](../type-aliases/Ai_knowledge_baseScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof ai\_knowledge\_baseGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` _extends_ `InputErrors` ? [`GetAi_knowledge_baseGroupByPayload`](../type-aliases/GetAi_knowledge_baseGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`>\>(`args`): [`Prisma__ai_knowledge_baseClient`](Prisma__ai_knowledge_baseClient.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:9323

Update one Ai_knowledge_base.

#### Type Parameters

##### T

`T` _extends_ [`ai_knowledge_baseUpdateArgs`](../type-aliases/ai_knowledge_baseUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_knowledge_baseUpdateArgs`](../type-aliases/ai_knowledge_baseUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Ai_knowledge_base.

#### Returns

[`Prisma__ai_knowledge_baseClient`](Prisma__ai_knowledge_baseClient.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Ai_knowledge_base
const ai_knowledge_base = await prisma.ai_knowledge_base.update({
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

Defined in: generated/prisma/index.d.ts:9356

Update zero or more Ai_knowledge_bases.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ai_knowledge_baseUpdateManyArgs`](../type-aliases/ai_knowledge_baseUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_knowledge_baseUpdateManyArgs`](../type-aliases/ai_knowledge_baseUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Ai_knowledge_bases
const ai_knowledge_base = await prisma.ai_knowledge_base.updateMany({
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

> **updateManyAndReturn**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:9386

Update zero or more Ai_knowledge_bases and returns the data updated in the database.

#### Type Parameters

##### T

`T` _extends_ [`ai_knowledge_baseUpdateManyAndReturnArgs`](../type-aliases/ai_knowledge_baseUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_knowledge_baseUpdateManyAndReturnArgs`](../type-aliases/ai_knowledge_baseUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Ai_knowledge_bases.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Ai_knowledge_bases
const ai_knowledge_base = await prisma.ai_knowledge_base.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Ai_knowledge_bases and only return the `id`
const ai_knowledge_baseWithIdOnly = await prisma.ai_knowledge_base.updateManyAndReturn({
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

> **upsert**\<`T`>\>(`args`): [`Prisma__ai_knowledge_baseClient`](Prisma__ai_knowledge_baseClient.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:9405

Create or update one Ai_knowledge_base.

#### Type Parameters

##### T

`T` _extends_ [`ai_knowledge_baseUpsertArgs`](../type-aliases/ai_knowledge_baseUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_knowledge_baseUpsertArgs`](../type-aliases/ai_knowledge_baseUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Ai_knowledge_base.

#### Returns

[`Prisma__ai_knowledge_baseClient`](Prisma__ai_knowledge_baseClient.md)\<`GetFindResult`\<[`$ai_knowledge_basePayload`](../type-aliases/$ai_knowledge_basePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Ai_knowledge_base
const ai_knowledge_base = await prisma.ai_knowledge_base.upsert({
    create: {
        // ... data to create a Ai_knowledge_base
    },
    update: {
        // ... in case it already exists, update
    },
    where: {
        // ... the filter for the Ai_knowledge_base we want to update
    }
});
```
