[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ai\_telemetry\_eventsDelegate

# Interface: ai\_telemetry\_eventsDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:5807

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`ai_telemetry_eventsFieldRefs`](ai_telemetry_eventsFieldRefs.md)

Defined in: generated/prisma/index.d.ts:6179

Fields of the ai_telemetry_events model

## Methods

### aggregate()

> **aggregate**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAi_telemetry_eventsAggregateType`](../type-aliases/GetAi_telemetry_eventsAggregateType.md)\<`T`>>\>\>

Defined in: generated/prisma/index.d.ts:6098

Allows you to perform aggregations operations on a Ai_telemetry_events.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`Ai_telemetry_eventsAggregateArgs`](../type-aliases/Ai_telemetry_eventsAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`Ai_telemetry_eventsAggregateArgs`](../type-aliases/Ai_telemetry_eventsAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAi_telemetry_eventsAggregateType`](../type-aliases/GetAi_telemetry_eventsAggregateType.md)\<`T`\>\>

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

> **count**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`> \> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Ai\_telemetry\_eventsCountAggregateOutputType ? Ai\_telemetry\_eventsCountAggregateOutputType\[P\] : never \} : `number`>\>

Defined in: generated/prisma/index.d.ts:6064

Count the number of Ai_telemetry_events.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ai_telemetry_eventsCountArgs`](../type-aliases/ai_telemetry_eventsCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`ai_telemetry_eventsCountArgs`](../type-aliases/ai_telemetry_eventsCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Ai_telemetry_events to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Ai\_telemetry\_eventsCountAggregateOutputType ? Ai\_telemetry\_eventsCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Ai_telemetry_events
const count = await prisma.ai_telemetry_events.count({
    where: {
        // ... the filter for the Ai_telemetry_events we want to count
    }
});
```

---

### create()

> **create**\<`T`>\>(`args`): [`Prisma__ai_telemetry_eventsClient`](Prisma__ai_telemetry_eventsClient.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:5897

Create a Ai_telemetry_events.

#### Type Parameters

##### T

`T` _extends_ [`ai_telemetry_eventsCreateArgs`](../type-aliases/ai_telemetry_eventsCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_eventsCreateArgs`](../type-aliases/ai_telemetry_eventsCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Ai_telemetry_events.

#### Returns

[`Prisma__ai_telemetry_eventsClient`](Prisma__ai_telemetry_eventsClient.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Ai_telemetry_events
const Ai_telemetry_events = await prisma.ai_telemetry_events.create({
    data: {
        // ... data to create a Ai_telemetry_events
    }
});
```

---

### createMany()

> **createMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:5911

Create many Ai_telemetry_events.

#### Type Parameters

##### T

`T` _extends_ [`ai_telemetry_eventsCreateManyArgs`](../type-aliases/ai_telemetry_eventsCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_eventsCreateManyArgs`](../type-aliases/ai_telemetry_eventsCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Ai_telemetry_events.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Ai_telemetry_events
const ai_telemetry_events = await prisma.ai_telemetry_events.createMany({
    data: [
        // ... provide data here
    ]
});
```

---

### createManyAndReturn()

> **createManyAndReturn**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:5935

Create many Ai_telemetry_events and returns the data saved in the database.

#### Type Parameters

##### T

`T` _extends_ [`ai_telemetry_eventsCreateManyAndReturnArgs`](../type-aliases/ai_telemetry_eventsCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_eventsCreateManyAndReturnArgs`](../type-aliases/ai_telemetry_eventsCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Ai_telemetry_events.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Ai_telemetry_events
const ai_telemetry_events = await prisma.ai_telemetry_events.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Ai_telemetry_events and only return the `id`
const ai_telemetry_eventsWithIdOnly = await prisma.ai_telemetry_events.createManyAndReturn({
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

> **delete**\<`T`>\>(`args`): [`Prisma__ai_telemetry_eventsClient`](Prisma__ai_telemetry_eventsClient.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:5949

Delete a Ai_telemetry_events.

#### Type Parameters

##### T

`T` _extends_ [`ai_telemetry_eventsDeleteArgs`](../type-aliases/ai_telemetry_eventsDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_eventsDeleteArgs`](../type-aliases/ai_telemetry_eventsDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Ai_telemetry_events.

#### Returns

[`Prisma__ai_telemetry_eventsClient`](Prisma__ai_telemetry_eventsClient.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Ai_telemetry_events
const Ai_telemetry_events = await prisma.ai_telemetry_events.delete({
    where: {
        // ... filter to delete one Ai_telemetry_events
    }
});
```

---

### deleteMany()

> **deleteMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:5980

Delete zero or more Ai_telemetry_events.

#### Type Parameters

##### T

`T` _extends_ [`ai_telemetry_eventsDeleteManyArgs`](../type-aliases/ai_telemetry_eventsDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_eventsDeleteManyArgs`](../type-aliases/ai_telemetry_eventsDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Ai_telemetry_events to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Ai_telemetry_events
const { count } = await prisma.ai_telemetry_events.deleteMany({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirst()

> **findFirst**\<`T`>\>(`args?`): [`Prisma__ai_telemetry_eventsClient`](Prisma__ai_telemetry_eventsClient.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:5849

Find the first Ai_telemetry_events that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ai_telemetry_eventsFindFirstArgs`](../type-aliases/ai_telemetry_eventsFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_eventsFindFirstArgs`](../type-aliases/ai_telemetry_eventsFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_telemetry_events

#### Returns

[`Prisma__ai_telemetry_eventsClient`](Prisma__ai_telemetry_eventsClient.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_telemetry_events
const ai_telemetry_events = await prisma.ai_telemetry_events.findFirst({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`>\>(`args?`): [`Prisma__ai_telemetry_eventsClient`](Prisma__ai_telemetry_eventsClient.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:5865

Find the first Ai_telemetry_events that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ai_telemetry_eventsFindFirstOrThrowArgs`](../type-aliases/ai_telemetry_eventsFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_eventsFindFirstOrThrowArgs`](../type-aliases/ai_telemetry_eventsFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_telemetry_events

#### Returns

[`Prisma__ai_telemetry_eventsClient`](Prisma__ai_telemetry_eventsClient.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_telemetry_events
const ai_telemetry_events = await prisma.ai_telemetry_events.findFirstOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### findMany()

> **findMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:5883

Find zero or more Ai_telemetry_events that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ai_telemetry_eventsFindManyArgs`](../type-aliases/ai_telemetry_eventsFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_eventsFindManyArgs`](../type-aliases/ai_telemetry_eventsFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Ai_telemetry_events
const ai_telemetry_events = await prisma.ai_telemetry_events.findMany();

// Get first 10 Ai_telemetry_events
const ai_telemetry_events = await prisma.ai_telemetry_events.findMany({ take: 10 });

// Only select the `id`
const ai_telemetry_eventsWithIdOnly = await prisma.ai_telemetry_events.findMany({
    select: { id: true }
});
```

---

### findUnique()

> **findUnique**\<`T`>\>(`args`): [`Prisma__ai_telemetry_eventsClient`](Prisma__ai_telemetry_eventsClient.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:5820

Find zero or one Ai_telemetry_events that matches the filter.

#### Type Parameters

##### T

`T` _extends_ [`ai_telemetry_eventsFindUniqueArgs`](../type-aliases/ai_telemetry_eventsFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_eventsFindUniqueArgs`](../type-aliases/ai_telemetry_eventsFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_telemetry_events

#### Returns

[`Prisma__ai_telemetry_eventsClient`](Prisma__ai_telemetry_eventsClient.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_telemetry_events
const ai_telemetry_events = await prisma.ai_telemetry_events.findUnique({
    where: {
        // ... provide filter here
    }
});
```

---

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`>\>(`args`): [`Prisma__ai_telemetry_eventsClient`](Prisma__ai_telemetry_eventsClient.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:5834

Find one Ai_telemetry_events that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` _extends_ [`ai_telemetry_eventsFindUniqueOrThrowArgs`](../type-aliases/ai_telemetry_eventsFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_eventsFindUniqueOrThrowArgs`](../type-aliases/ai_telemetry_eventsFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Ai_telemetry_events

#### Returns

[`Prisma__ai_telemetry_eventsClient`](Prisma__ai_telemetry_eventsClient.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Ai_telemetry_events
const ai_telemetry_events = await prisma.ai_telemetry_events.findUniqueOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`>\>(`args`): `object` _extends_ `InputErrors` ? [`GetAi_telemetry_eventsGroupByPayload`](../type-aliases/GetAi_telemetry_eventsGroupByPayload.md)\<`T`> \> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`>\>

Defined in: generated/prisma/index.d.ts:6118

Group by Ai_telemetry_events.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ai_telemetry_eventsGroupByArgs`](../type-aliases/ai_telemetry_eventsGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` _extends_ `0` \| `1`

##### OrderByArg

`OrderByArg` _extends_ \{ `orderBy`: [`ai_telemetry_eventsOrderByWithAggregationInput`](../type-aliases/ai_telemetry_eventsOrderByWithAggregationInput.md) \| [`ai_telemetry_eventsOrderByWithAggregationInput`](../type-aliases/ai_telemetry_eventsOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`ai_telemetry_eventsOrderByWithAggregationInput`](../type-aliases/ai_telemetry_eventsOrderByWithAggregationInput.md) \| [`ai_telemetry_eventsOrderByWithAggregationInput`](../type-aliases/ai_telemetry_eventsOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` _extends_ `"id"` \| `"createdAt"` \| `"telemetryId"` \| `"userId"` \| `"wellId"` \| `"eventType"` \| `"componentId"` \| `"previousValue"` \| `"newValue"` \| `"changeReason"` \| `"msSinceConfig"` \| `"orderInSession"` \| `"sequenceNo"`

##### ByFields

`ByFields` _extends_ [`Ai_telemetry_eventsScalarFieldEnum`](../type-aliases/Ai_telemetry_eventsScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof ai\_telemetry\_eventsGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` _extends_ `InputErrors` ? [`GetAi_telemetry_eventsGroupByPayload`](../type-aliases/GetAi_telemetry_eventsGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`>\>(`args`): [`Prisma__ai_telemetry_eventsClient`](Prisma__ai_telemetry_eventsClient.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:5966

Update one Ai_telemetry_events.

#### Type Parameters

##### T

`T` _extends_ [`ai_telemetry_eventsUpdateArgs`](../type-aliases/ai_telemetry_eventsUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_eventsUpdateArgs`](../type-aliases/ai_telemetry_eventsUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Ai_telemetry_events.

#### Returns

[`Prisma__ai_telemetry_eventsClient`](Prisma__ai_telemetry_eventsClient.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Ai_telemetry_events
const ai_telemetry_events = await prisma.ai_telemetry_events.update({
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

Defined in: generated/prisma/index.d.ts:5999

Update zero or more Ai_telemetry_events.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ai_telemetry_eventsUpdateManyArgs`](../type-aliases/ai_telemetry_eventsUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_eventsUpdateManyArgs`](../type-aliases/ai_telemetry_eventsUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Ai_telemetry_events
const ai_telemetry_events = await prisma.ai_telemetry_events.updateMany({
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

> **updateManyAndReturn**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:6029

Update zero or more Ai_telemetry_events and returns the data updated in the database.

#### Type Parameters

##### T

`T` _extends_ [`ai_telemetry_eventsUpdateManyAndReturnArgs`](../type-aliases/ai_telemetry_eventsUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_eventsUpdateManyAndReturnArgs`](../type-aliases/ai_telemetry_eventsUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Ai_telemetry_events.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Ai_telemetry_events
const ai_telemetry_events = await prisma.ai_telemetry_events.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Ai_telemetry_events and only return the `id`
const ai_telemetry_eventsWithIdOnly = await prisma.ai_telemetry_events.updateManyAndReturn({
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

> **upsert**\<`T`>\>(`args`): [`Prisma__ai_telemetry_eventsClient`](Prisma__ai_telemetry_eventsClient.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:6048

Create or update one Ai_telemetry_events.

#### Type Parameters

##### T

`T` _extends_ [`ai_telemetry_eventsUpsertArgs`](../type-aliases/ai_telemetry_eventsUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ai_telemetry_eventsUpsertArgs`](../type-aliases/ai_telemetry_eventsUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Ai_telemetry_events.

#### Returns

[`Prisma__ai_telemetry_eventsClient`](Prisma__ai_telemetry_eventsClient.md)\<`GetFindResult`\<[`$ai_telemetry_eventsPayload`](../type-aliases/$ai_telemetry_eventsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Ai_telemetry_events
const ai_telemetry_events = await prisma.ai_telemetry_events.upsert({
    create: {
        // ... data to create a Ai_telemetry_events
    },
    update: {
        // ... in case it already exists, update
    },
    where: {
        // ... the filter for the Ai_telemetry_events we want to update
    }
});
```
