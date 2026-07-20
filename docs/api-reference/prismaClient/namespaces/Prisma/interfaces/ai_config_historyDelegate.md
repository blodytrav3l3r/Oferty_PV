[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_config\_historyDelegate

# Interface: ai\_config\_historyDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:6930

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`ai_config_historyFieldRefs`](ai_config_historyFieldRefs.md)

Defined in: generated/prisma/index.d.ts:7302

Fields of the ai_config_history model

## Methods

### aggregate()

> **aggregate**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAi_config_historyAggregateType`](../type-aliases/GetAi_config_historyAggregateType.md)\<`T`>>\>\>

Defined in: generated/prisma/index.d.ts:7221

Allows you to perform aggregations operations on a Ai_config_history.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`Ai_config_historyAggregateArgs`](../type-aliases/Ai_config_historyAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`Ai_config_historyAggregateArgs`](../type-aliases/Ai_config_historyAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAi_config_historyAggregateType`](../type-aliases/GetAi_config_historyAggregateType.md)\<`T`\>\>

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

> **count**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`> \> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Ai\_config\_historyCountAggregateOutputType ? Ai\_config\_historyCountAggregateOutputType\[P\] : never \} : `number`>\>

Defined in: generated/prisma/index.d.ts:7187

Count the number of Ai_config_histories.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ai_config_historyCountArgs`](../type-aliases/ai_config_historyCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`ai_config_historyCountArgs`](../type-aliases/ai_config_historyCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Ai_config_histories to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Ai\_config\_historyCountAggregateOutputType ? Ai\_config\_historyCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Ai_config_histories
const count = await prisma.ai_config_history.count({
    where: {
        // ... the filter for the Ai_config_histories we want to count
    }
});
```

---

### create()

> **create**\<`T`>\>(`args`): [`Prisma__ai_config_historyClient`](Prisma__ai_config_historyClient.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:7020

Create a Ai_config_history.

#### Type Parameters

##### T

`T` _extends_ [`ai_config_historyCreateArgs`](../type-aliases/ai_config_historyCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_config_historyCreateArgs`](../type-aliases/ai_config_historyCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Ai_config_history.

#### Returns

[`Prisma__ai_config_historyClient`](Prisma__ai_config_historyClient.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Ai_config_history
const Ai_config_history = await prisma.ai_config_history.create({
    data: {
        // ... data to create a Ai_config_history
    }
});
```

---

### createMany()

> **createMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:7034

Create many Ai_config_histories.

#### Type Parameters

##### T

`T` _extends_ [`ai_config_historyCreateManyArgs`](../type-aliases/ai_config_historyCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_config_historyCreateManyArgs`](../type-aliases/ai_config_historyCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Ai_config_histories.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Ai_config_histories
const ai_config_history = await prisma.ai_config_history.createMany({
    data: [
        // ... provide data here
    ]
});
```

---

### createManyAndReturn()

> **createManyAndReturn**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:7058

Create many Ai_config_histories and returns the data saved in the database.

#### Type Parameters

##### T

`T` _extends_ [`ai_config_historyCreateManyAndReturnArgs`](../type-aliases/ai_config_historyCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_config_historyCreateManyAndReturnArgs`](../type-aliases/ai_config_historyCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Ai_config_histories.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Ai_config_histories
const ai_config_history = await prisma.ai_config_history.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Ai_config_histories and only return the `id`
const ai_config_historyWithIdOnly = await prisma.ai_config_history.createManyAndReturn({
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

> **delete**\<`T`>\>(`args`): [`Prisma__ai_config_historyClient`](Prisma__ai_config_historyClient.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:7072

Delete a Ai_config_history.

#### Type Parameters

##### T

`T` _extends_ [`ai_config_historyDeleteArgs`](../type-aliases/ai_config_historyDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_config_historyDeleteArgs`](../type-aliases/ai_config_historyDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Ai_config_history.

#### Returns

[`Prisma__ai_config_historyClient`](Prisma__ai_config_historyClient.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Ai_config_history
const Ai_config_history = await prisma.ai_config_history.delete({
    where: {
        // ... filter to delete one Ai_config_history
    }
});
```

---

### deleteMany()

> **deleteMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:7103

Delete zero or more Ai_config_histories.

#### Type Parameters

##### T

`T` _extends_ [`ai_config_historyDeleteManyArgs`](../type-aliases/ai_config_historyDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_config_historyDeleteManyArgs`](../type-aliases/ai_config_historyDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Ai_config_histories to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Ai_config_histories
const { count } = await prisma.ai_config_history.deleteMany({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirst()

> **findFirst**\<`T`>\>(`args?`): [`Prisma__ai_config_historyClient`](Prisma__ai_config_historyClient.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:6972

Find the first Ai_config_history that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ai_config_historyFindFirstArgs`](../type-aliases/ai_config_historyFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_config_historyFindFirstArgs`](../type-aliases/ai_config_historyFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_config_history

#### Returns

[`Prisma__ai_config_historyClient`](Prisma__ai_config_historyClient.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_config_history
const ai_config_history = await prisma.ai_config_history.findFirst({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`>\>(`args?`): [`Prisma__ai_config_historyClient`](Prisma__ai_config_historyClient.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:6988

Find the first Ai_config_history that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ai_config_historyFindFirstOrThrowArgs`](../type-aliases/ai_config_historyFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_config_historyFindFirstOrThrowArgs`](../type-aliases/ai_config_historyFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_config_history

#### Returns

[`Prisma__ai_config_historyClient`](Prisma__ai_config_historyClient.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_config_history
const ai_config_history = await prisma.ai_config_history.findFirstOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### findMany()

> **findMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:7006

Find zero or more Ai_config_histories that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ai_config_historyFindManyArgs`](../type-aliases/ai_config_historyFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_config_historyFindManyArgs`](../type-aliases/ai_config_historyFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Ai_config_histories
const ai_config_histories = await prisma.ai_config_history.findMany();

// Get first 10 Ai_config_histories
const ai_config_histories = await prisma.ai_config_history.findMany({ take: 10 });

// Only select the `id`
const ai_config_historyWithIdOnly = await prisma.ai_config_history.findMany({
    select: { id: true }
});
```

---

### findUnique()

> **findUnique**\<`T`>\>(`args`): [`Prisma__ai_config_historyClient`](Prisma__ai_config_historyClient.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:6943

Find zero or one Ai_config_history that matches the filter.

#### Type Parameters

##### T

`T` _extends_ [`ai_config_historyFindUniqueArgs`](../type-aliases/ai_config_historyFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_config_historyFindUniqueArgs`](../type-aliases/ai_config_historyFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_config_history

#### Returns

[`Prisma__ai_config_historyClient`](Prisma__ai_config_historyClient.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_config_history
const ai_config_history = await prisma.ai_config_history.findUnique({
    where: {
        // ... provide filter here
    }
});
```

---

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`>\>(`args`): [`Prisma__ai_config_historyClient`](Prisma__ai_config_historyClient.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:6957

Find one Ai_config_history that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` _extends_ [`ai_config_historyFindUniqueOrThrowArgs`](../type-aliases/ai_config_historyFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_config_historyFindUniqueOrThrowArgs`](../type-aliases/ai_config_historyFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_config_history

#### Returns

[`Prisma__ai_config_historyClient`](Prisma__ai_config_historyClient.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_config_history
const ai_config_history = await prisma.ai_config_history.findUniqueOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`>\>(`args`): `object` _extends_ `InputErrors` ? [`GetAi_config_historyGroupByPayload`](../type-aliases/GetAi_config_historyGroupByPayload.md)\<`T`> \> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`>\>

Defined in: generated/prisma/index.d.ts:7241

Group by Ai_config_history.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ai_config_historyGroupByArgs`](../type-aliases/ai_config_historyGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` _extends_ `0` \| `1`

##### OrderByArg

`OrderByArg` _extends_ \{ `orderBy`: [`ai_config_historyOrderByWithAggregationInput`](../type-aliases/ai_config_historyOrderByWithAggregationInput.md) \| [`ai_config_historyOrderByWithAggregationInput`](../type-aliases/ai_config_historyOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`ai_config_historyOrderByWithAggregationInput`](../type-aliases/ai_config_historyOrderByWithAggregationInput.md) \| [`ai_config_historyOrderByWithAggregationInput`](../type-aliases/ai_config_historyOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` _extends_ `"id"` \| `"createdAt"` \| `"wellId"` \| `"rankingScore"` \| `"selectionReason"` \| `"configVersion"` \| `"parentId"` \| `"configJson"` \| `"source"` \| `"triggeredBy"` \| `"diffFromParent"` \| `"isCurrent"`

##### ByFields

`ByFields` _extends_ [`Ai_config_historyScalarFieldEnum`](../type-aliases/Ai_config_historyScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof ai\_config\_historyGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` _extends_ `InputErrors` ? [`GetAi_config_historyGroupByPayload`](../type-aliases/GetAi_config_historyGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`>\>(`args`): [`Prisma__ai_config_historyClient`](Prisma__ai_config_historyClient.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:7089

Update one Ai_config_history.

#### Type Parameters

##### T

`T` _extends_ [`ai_config_historyUpdateArgs`](../type-aliases/ai_config_historyUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_config_historyUpdateArgs`](../type-aliases/ai_config_historyUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Ai_config_history.

#### Returns

[`Prisma__ai_config_historyClient`](Prisma__ai_config_historyClient.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Ai_config_history
const ai_config_history = await prisma.ai_config_history.update({
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

Defined in: generated/prisma/index.d.ts:7122

Update zero or more Ai_config_histories.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ai_config_historyUpdateManyArgs`](../type-aliases/ai_config_historyUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_config_historyUpdateManyArgs`](../type-aliases/ai_config_historyUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Ai_config_histories
const ai_config_history = await prisma.ai_config_history.updateMany({
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

> **updateManyAndReturn**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:7152

Update zero or more Ai_config_histories and returns the data updated in the database.

#### Type Parameters

##### T

`T` _extends_ [`ai_config_historyUpdateManyAndReturnArgs`](../type-aliases/ai_config_historyUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_config_historyUpdateManyAndReturnArgs`](../type-aliases/ai_config_historyUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Ai_config_histories.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Ai_config_histories
const ai_config_history = await prisma.ai_config_history.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Ai_config_histories and only return the `id`
const ai_config_historyWithIdOnly = await prisma.ai_config_history.updateManyAndReturn({
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

> **upsert**\<`T`>\>(`args`): [`Prisma__ai_config_historyClient`](Prisma__ai_config_historyClient.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:7171

Create or update one Ai_config_history.

#### Type Parameters

##### T

`T` _extends_ [`ai_config_historyUpsertArgs`](../type-aliases/ai_config_historyUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_config_historyUpsertArgs`](../type-aliases/ai_config_historyUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Ai_config_history.

#### Returns

[`Prisma__ai_config_historyClient`](Prisma__ai_config_historyClient.md)\<`GetFindResult`\<[`$ai_config_historyPayload`](../type-aliases/$ai_config_historyPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Ai_config_history
const ai_config_history = await prisma.ai_config_history.upsert({
    create: {
        // ... data to create a Ai_config_history
    },
    update: {
        // ... in case it already exists, update
    },
    where: {
        // ... the filter for the Ai_config_history we want to update
    }
});
```
