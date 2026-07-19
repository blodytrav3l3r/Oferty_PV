[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / aiRewardLogDelegate

# Interface: aiRewardLogDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:36498

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`aiRewardLogFieldRefs`](aiRewardLogFieldRefs.md)

Defined in: generated/prisma/index.d.ts:36870

Fields of the aiRewardLog model

## Methods

### aggregate()

> **aggregate**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAiRewardLogAggregateType`](../type-aliases/GetAiRewardLogAggregateType.md)\<`T`>>\>\>

Defined in: generated/prisma/index.d.ts:36789

Allows you to perform aggregations operations on a AiRewardLog.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`AiRewardLogAggregateArgs`](../type-aliases/AiRewardLogAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`AiRewardLogAggregateArgs`](../type-aliases/AiRewardLogAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAiRewardLogAggregateType`](../type-aliases/GetAiRewardLogAggregateType.md)\<`T`\>\>

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

> **count**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`> \> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof AiRewardLogCountAggregateOutputType ? AiRewardLogCountAggregateOutputType\[P\] : never \} : `number`>\>

Defined in: generated/prisma/index.d.ts:36755

Count the number of AiRewardLogs.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`aiRewardLogCountArgs`](../type-aliases/aiRewardLogCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`aiRewardLogCountArgs`](../type-aliases/aiRewardLogCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter AiRewardLogs to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof AiRewardLogCountAggregateOutputType ? AiRewardLogCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of AiRewardLogs
const count = await prisma.aiRewardLog.count({
    where: {
        // ... the filter for the AiRewardLogs we want to count
    }
});
```

---

### create()

> **create**\<`T`>\>(`args`): [`Prisma__aiRewardLogClient`](Prisma__aiRewardLogClient.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:36588

Create a AiRewardLog.

#### Type Parameters

##### T

`T` _extends_ [`aiRewardLogCreateArgs`](../type-aliases/aiRewardLogCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`aiRewardLogCreateArgs`](../type-aliases/aiRewardLogCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a AiRewardLog.

#### Returns

[`Prisma__aiRewardLogClient`](Prisma__aiRewardLogClient.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one AiRewardLog
const AiRewardLog = await prisma.aiRewardLog.create({
    data: {
        // ... data to create a AiRewardLog
    }
});
```

---

### createMany()

> **createMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:36602

Create many AiRewardLogs.

#### Type Parameters

##### T

`T` _extends_ [`aiRewardLogCreateManyArgs`](../type-aliases/aiRewardLogCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`aiRewardLogCreateManyArgs`](../type-aliases/aiRewardLogCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many AiRewardLogs.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many AiRewardLogs
const aiRewardLog = await prisma.aiRewardLog.createMany({
    data: [
        // ... provide data here
    ]
});
```

---

### createManyAndReturn()

> **createManyAndReturn**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:36626

Create many AiRewardLogs and returns the data saved in the database.

#### Type Parameters

##### T

`T` _extends_ [`aiRewardLogCreateManyAndReturnArgs`](../type-aliases/aiRewardLogCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`aiRewardLogCreateManyAndReturnArgs`](../type-aliases/aiRewardLogCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many AiRewardLogs.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many AiRewardLogs
const aiRewardLog = await prisma.aiRewardLog.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many AiRewardLogs and only return the `id`
const aiRewardLogWithIdOnly = await prisma.aiRewardLog.createManyAndReturn({
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

> **delete**\<`T`>\>(`args`): [`Prisma__aiRewardLogClient`](Prisma__aiRewardLogClient.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:36640

Delete a AiRewardLog.

#### Type Parameters

##### T

`T` _extends_ [`aiRewardLogDeleteArgs`](../type-aliases/aiRewardLogDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`aiRewardLogDeleteArgs`](../type-aliases/aiRewardLogDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one AiRewardLog.

#### Returns

[`Prisma__aiRewardLogClient`](Prisma__aiRewardLogClient.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one AiRewardLog
const AiRewardLog = await prisma.aiRewardLog.delete({
    where: {
        // ... filter to delete one AiRewardLog
    }
});
```

---

### deleteMany()

> **deleteMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:36671

Delete zero or more AiRewardLogs.

#### Type Parameters

##### T

`T` _extends_ [`aiRewardLogDeleteManyArgs`](../type-aliases/aiRewardLogDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`aiRewardLogDeleteManyArgs`](../type-aliases/aiRewardLogDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter AiRewardLogs to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few AiRewardLogs
const { count } = await prisma.aiRewardLog.deleteMany({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirst()

> **findFirst**\<`T`>\>(`args?`): [`Prisma__aiRewardLogClient`](Prisma__aiRewardLogClient.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:36540

Find the first AiRewardLog that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`aiRewardLogFindFirstArgs`](../type-aliases/aiRewardLogFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`aiRewardLogFindFirstArgs`](../type-aliases/aiRewardLogFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a AiRewardLog

#### Returns

[`Prisma__aiRewardLogClient`](Prisma__aiRewardLogClient.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one AiRewardLog
const aiRewardLog = await prisma.aiRewardLog.findFirst({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`>\>(`args?`): [`Prisma__aiRewardLogClient`](Prisma__aiRewardLogClient.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:36556

Find the first AiRewardLog that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`aiRewardLogFindFirstOrThrowArgs`](../type-aliases/aiRewardLogFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`aiRewardLogFindFirstOrThrowArgs`](../type-aliases/aiRewardLogFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a AiRewardLog

#### Returns

[`Prisma__aiRewardLogClient`](Prisma__aiRewardLogClient.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one AiRewardLog
const aiRewardLog = await prisma.aiRewardLog.findFirstOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### findMany()

> **findMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:36574

Find zero or more AiRewardLogs that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`aiRewardLogFindManyArgs`](../type-aliases/aiRewardLogFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`aiRewardLogFindManyArgs`](../type-aliases/aiRewardLogFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all AiRewardLogs
const aiRewardLogs = await prisma.aiRewardLog.findMany();

// Get first 10 AiRewardLogs
const aiRewardLogs = await prisma.aiRewardLog.findMany({ take: 10 });

// Only select the `id`
const aiRewardLogWithIdOnly = await prisma.aiRewardLog.findMany({ select: { id: true } });
```

---

### findUnique()

> **findUnique**\<`T`>\>(`args`): [`Prisma__aiRewardLogClient`](Prisma__aiRewardLogClient.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:36511

Find zero or one AiRewardLog that matches the filter.

#### Type Parameters

##### T

`T` _extends_ [`aiRewardLogFindUniqueArgs`](../type-aliases/aiRewardLogFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`aiRewardLogFindUniqueArgs`](../type-aliases/aiRewardLogFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a AiRewardLog

#### Returns

[`Prisma__aiRewardLogClient`](Prisma__aiRewardLogClient.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one AiRewardLog
const aiRewardLog = await prisma.aiRewardLog.findUnique({
    where: {
        // ... provide filter here
    }
});
```

---

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`>\>(`args`): [`Prisma__aiRewardLogClient`](Prisma__aiRewardLogClient.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:36525

Find one AiRewardLog that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` _extends_ [`aiRewardLogFindUniqueOrThrowArgs`](../type-aliases/aiRewardLogFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`aiRewardLogFindUniqueOrThrowArgs`](../type-aliases/aiRewardLogFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a AiRewardLog

#### Returns

[`Prisma__aiRewardLogClient`](Prisma__aiRewardLogClient.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one AiRewardLog
const aiRewardLog = await prisma.aiRewardLog.findUniqueOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`>\>(`args`): `object` _extends_ `InputErrors` ? [`GetAiRewardLogGroupByPayload`](../type-aliases/GetAiRewardLogGroupByPayload.md)\<`T`> \> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`>\>

Defined in: generated/prisma/index.d.ts:36809

Group by AiRewardLog.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`aiRewardLogGroupByArgs`](../type-aliases/aiRewardLogGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` _extends_ `0` \| `1`

##### OrderByArg

`OrderByArg` _extends_ \{ `orderBy`: [`aiRewardLogOrderByWithAggregationInput`](../type-aliases/aiRewardLogOrderByWithAggregationInput.md) \| [`aiRewardLogOrderByWithAggregationInput`](../type-aliases/aiRewardLogOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`aiRewardLogOrderByWithAggregationInput`](../type-aliases/aiRewardLogOrderByWithAggregationInput.md) \| [`aiRewardLogOrderByWithAggregationInput`](../type-aliases/aiRewardLogOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` _extends_ `"id"` \| `"createdAt"` \| `"dn"` \| `"reward"` \| `"userId"` \| `"wellId"` \| `"action"` \| `"configSnapshot"` \| `"scoreBefore"` \| `"scoreAfter"` \| `"wasAiRanked"`

##### ByFields

`ByFields` _extends_ [`AiRewardLogScalarFieldEnum`](../type-aliases/AiRewardLogScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof aiRewardLogGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` _extends_ `InputErrors` ? [`GetAiRewardLogGroupByPayload`](../type-aliases/GetAiRewardLogGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`>\>(`args`): [`Prisma__aiRewardLogClient`](Prisma__aiRewardLogClient.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:36657

Update one AiRewardLog.

#### Type Parameters

##### T

`T` _extends_ [`aiRewardLogUpdateArgs`](../type-aliases/aiRewardLogUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`aiRewardLogUpdateArgs`](../type-aliases/aiRewardLogUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one AiRewardLog.

#### Returns

[`Prisma__aiRewardLogClient`](Prisma__aiRewardLogClient.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one AiRewardLog
const aiRewardLog = await prisma.aiRewardLog.update({
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

Defined in: generated/prisma/index.d.ts:36690

Update zero or more AiRewardLogs.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`aiRewardLogUpdateManyArgs`](../type-aliases/aiRewardLogUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`aiRewardLogUpdateManyArgs`](../type-aliases/aiRewardLogUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many AiRewardLogs
const aiRewardLog = await prisma.aiRewardLog.updateMany({
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

> **updateManyAndReturn**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:36720

Update zero or more AiRewardLogs and returns the data updated in the database.

#### Type Parameters

##### T

`T` _extends_ [`aiRewardLogUpdateManyAndReturnArgs`](../type-aliases/aiRewardLogUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`aiRewardLogUpdateManyAndReturnArgs`](../type-aliases/aiRewardLogUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many AiRewardLogs.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many AiRewardLogs
const aiRewardLog = await prisma.aiRewardLog.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more AiRewardLogs and only return the `id`
const aiRewardLogWithIdOnly = await prisma.aiRewardLog.updateManyAndReturn({
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

> **upsert**\<`T`>\>(`args`): [`Prisma__aiRewardLogClient`](Prisma__aiRewardLogClient.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:36739

Create or update one AiRewardLog.

#### Type Parameters

##### T

`T` _extends_ [`aiRewardLogUpsertArgs`](../type-aliases/aiRewardLogUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`aiRewardLogUpsertArgs`](../type-aliases/aiRewardLogUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a AiRewardLog.

#### Returns

[`Prisma__aiRewardLogClient`](Prisma__aiRewardLogClient.md)\<`GetFindResult`\<[`$aiRewardLogPayload`](../type-aliases/$aiRewardLogPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a AiRewardLog
const aiRewardLog = await prisma.aiRewardLog.upsert({
    create: {
        // ... data to create a AiRewardLog
    },
    update: {
        // ... in case it already exists, update
    },
    where: {
        // ... the filter for the AiRewardLog we want to update
    }
});
```
