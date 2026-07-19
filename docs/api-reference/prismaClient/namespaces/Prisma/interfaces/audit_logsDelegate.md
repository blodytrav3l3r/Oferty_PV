[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / audit\_logsDelegate

# Interface: audit\_logsDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:12566

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`audit_logsFieldRefs`](audit_logsFieldRefs.md)

Defined in: generated/prisma/index.d.ts:12938

Fields of the audit_logs model

## Methods

### aggregate()

> **aggregate**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAudit_logsAggregateType`](../type-aliases/GetAudit_logsAggregateType.md)\<`T`>>\>\>

Defined in: generated/prisma/index.d.ts:12857

Allows you to perform aggregations operations on a Audit_logs.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`Audit_logsAggregateArgs`](../type-aliases/Audit_logsAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`Audit_logsAggregateArgs`](../type-aliases/Audit_logsAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetAudit_logsAggregateType`](../type-aliases/GetAudit_logsAggregateType.md)\<`T`\>\>

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

> **count**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`> \> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Audit\_logsCountAggregateOutputType ? Audit\_logsCountAggregateOutputType\[P\] : never \} : `number`>\>

Defined in: generated/prisma/index.d.ts:12823

Count the number of Audit_logs.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`audit_logsCountArgs`](../type-aliases/audit_logsCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`audit_logsCountArgs`](../type-aliases/audit_logsCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Audit_logs to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Audit\_logsCountAggregateOutputType ? Audit\_logsCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Audit_logs
const count = await prisma.audit_logs.count({
    where: {
        // ... the filter for the Audit_logs we want to count
    }
});
```

---

### create()

> **create**\<`T`>\>(`args`): [`Prisma__audit_logsClient`](Prisma__audit_logsClient.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:12656

Create a Audit_logs.

#### Type Parameters

##### T

`T` _extends_ [`audit_logsCreateArgs`](../type-aliases/audit_logsCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`audit_logsCreateArgs`](../type-aliases/audit_logsCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Audit_logs.

#### Returns

[`Prisma__audit_logsClient`](Prisma__audit_logsClient.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Audit_logs
const Audit_logs = await prisma.audit_logs.create({
    data: {
        // ... data to create a Audit_logs
    }
});
```

---

### createMany()

> **createMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:12670

Create many Audit_logs.

#### Type Parameters

##### T

`T` _extends_ [`audit_logsCreateManyArgs`](../type-aliases/audit_logsCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`audit_logsCreateManyArgs`](../type-aliases/audit_logsCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Audit_logs.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Audit_logs
const audit_logs = await prisma.audit_logs.createMany({
    data: [
        // ... provide data here
    ]
});
```

---

### createManyAndReturn()

> **createManyAndReturn**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:12694

Create many Audit_logs and returns the data saved in the database.

#### Type Parameters

##### T

`T` _extends_ [`audit_logsCreateManyAndReturnArgs`](../type-aliases/audit_logsCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`audit_logsCreateManyAndReturnArgs`](../type-aliases/audit_logsCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Audit_logs.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Audit_logs
const audit_logs = await prisma.audit_logs.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Audit_logs and only return the `id`
const audit_logsWithIdOnly = await prisma.audit_logs.createManyAndReturn({
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

> **delete**\<`T`>\>(`args`): [`Prisma__audit_logsClient`](Prisma__audit_logsClient.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:12708

Delete a Audit_logs.

#### Type Parameters

##### T

`T` _extends_ [`audit_logsDeleteArgs`](../type-aliases/audit_logsDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`audit_logsDeleteArgs`](../type-aliases/audit_logsDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Audit_logs.

#### Returns

[`Prisma__audit_logsClient`](Prisma__audit_logsClient.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Audit_logs
const Audit_logs = await prisma.audit_logs.delete({
    where: {
        // ... filter to delete one Audit_logs
    }
});
```

---

### deleteMany()

> **deleteMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:12739

Delete zero or more Audit_logs.

#### Type Parameters

##### T

`T` _extends_ [`audit_logsDeleteManyArgs`](../type-aliases/audit_logsDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`audit_logsDeleteManyArgs`](../type-aliases/audit_logsDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Audit_logs to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Audit_logs
const { count } = await prisma.audit_logs.deleteMany({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirst()

> **findFirst**\<`T`>\>(`args?`): [`Prisma__audit_logsClient`](Prisma__audit_logsClient.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:12608

Find the first Audit_logs that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`audit_logsFindFirstArgs`](../type-aliases/audit_logsFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`audit_logsFindFirstArgs`](../type-aliases/audit_logsFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Audit_logs

#### Returns

[`Prisma__audit_logsClient`](Prisma__audit_logsClient.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Audit_logs
const audit_logs = await prisma.audit_logs.findFirst({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`>\>(`args?`): [`Prisma__audit_logsClient`](Prisma__audit_logsClient.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:12624

Find the first Audit_logs that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`audit_logsFindFirstOrThrowArgs`](../type-aliases/audit_logsFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`audit_logsFindFirstOrThrowArgs`](../type-aliases/audit_logsFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Audit_logs

#### Returns

[`Prisma__audit_logsClient`](Prisma__audit_logsClient.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Audit_logs
const audit_logs = await prisma.audit_logs.findFirstOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### findMany()

> **findMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:12642

Find zero or more Audit_logs that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`audit_logsFindManyArgs`](../type-aliases/audit_logsFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`audit_logsFindManyArgs`](../type-aliases/audit_logsFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Audit_logs
const audit_logs = await prisma.audit_logs.findMany();

// Get first 10 Audit_logs
const audit_logs = await prisma.audit_logs.findMany({ take: 10 });

// Only select the `id`
const audit_logsWithIdOnly = await prisma.audit_logs.findMany({ select: { id: true } });
```

---

### findUnique()

> **findUnique**\<`T`>\>(`args`): [`Prisma__audit_logsClient`](Prisma__audit_logsClient.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:12579

Find zero or one Audit_logs that matches the filter.

#### Type Parameters

##### T

`T` _extends_ [`audit_logsFindUniqueArgs`](../type-aliases/audit_logsFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`audit_logsFindUniqueArgs`](../type-aliases/audit_logsFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Audit_logs

#### Returns

[`Prisma__audit_logsClient`](Prisma__audit_logsClient.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Audit_logs
const audit_logs = await prisma.audit_logs.findUnique({
    where: {
        // ... provide filter here
    }
});
```

---

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`>\>(`args`): [`Prisma__audit_logsClient`](Prisma__audit_logsClient.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:12593

Find one Audit_logs that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` _extends_ [`audit_logsFindUniqueOrThrowArgs`](../type-aliases/audit_logsFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`audit_logsFindUniqueOrThrowArgs`](../type-aliases/audit_logsFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Audit_logs

#### Returns

[`Prisma__audit_logsClient`](Prisma__audit_logsClient.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Audit_logs
const audit_logs = await prisma.audit_logs.findUniqueOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`>\>(`args`): `object` _extends_ `InputErrors` ? [`GetAudit_logsGroupByPayload`](../type-aliases/GetAudit_logsGroupByPayload.md)\<`T`> \> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`>\>

Defined in: generated/prisma/index.d.ts:12877

Group by Audit_logs.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`audit_logsGroupByArgs`](../type-aliases/audit_logsGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` _extends_ `0` \| `1`

##### OrderByArg

`OrderByArg` _extends_ \{ `orderBy`: [`audit_logsOrderByWithAggregationInput`](../type-aliases/audit_logsOrderByWithAggregationInput.md) \| [`audit_logsOrderByWithAggregationInput`](../type-aliases/audit_logsOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`audit_logsOrderByWithAggregationInput`](../type-aliases/audit_logsOrderByWithAggregationInput.md) \| [`audit_logsOrderByWithAggregationInput`](../type-aliases/audit_logsOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` _extends_ `"id"` \| `"createdAt"` \| `"userId"` \| `"action"` \| `"entityType"` \| `"entityId"` \| `"oldData"` \| `"newData"`

##### ByFields

`ByFields` _extends_ [`Audit_logsScalarFieldEnum`](../type-aliases/Audit_logsScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof audit\_logsGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` _extends_ `InputErrors` ? [`GetAudit_logsGroupByPayload`](../type-aliases/GetAudit_logsGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`>\>(`args`): [`Prisma__audit_logsClient`](Prisma__audit_logsClient.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:12725

Update one Audit_logs.

#### Type Parameters

##### T

`T` _extends_ [`audit_logsUpdateArgs`](../type-aliases/audit_logsUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`audit_logsUpdateArgs`](../type-aliases/audit_logsUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Audit_logs.

#### Returns

[`Prisma__audit_logsClient`](Prisma__audit_logsClient.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Audit_logs
const audit_logs = await prisma.audit_logs.update({
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

Defined in: generated/prisma/index.d.ts:12758

Update zero or more Audit_logs.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`audit_logsUpdateManyArgs`](../type-aliases/audit_logsUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`audit_logsUpdateManyArgs`](../type-aliases/audit_logsUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Audit_logs
const audit_logs = await prisma.audit_logs.updateMany({
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

> **updateManyAndReturn**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:12788

Update zero or more Audit_logs and returns the data updated in the database.

#### Type Parameters

##### T

`T` _extends_ [`audit_logsUpdateManyAndReturnArgs`](../type-aliases/audit_logsUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`audit_logsUpdateManyAndReturnArgs`](../type-aliases/audit_logsUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Audit_logs.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Audit_logs
const audit_logs = await prisma.audit_logs.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Audit_logs and only return the `id`
const audit_logsWithIdOnly = await prisma.audit_logs.updateManyAndReturn({
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

> **upsert**\<`T`>\>(`args`): [`Prisma__audit_logsClient`](Prisma__audit_logsClient.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:12807

Create or update one Audit_logs.

#### Type Parameters

##### T

`T` _extends_ [`audit_logsUpsertArgs`](../type-aliases/audit_logsUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`audit_logsUpsertArgs`](../type-aliases/audit_logsUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Audit_logs.

#### Returns

[`Prisma__audit_logsClient`](Prisma__audit_logsClient.md)\<`GetFindResult`\<[`$audit_logsPayload`](../type-aliases/$audit_logsPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Audit_logs
const audit_logs = await prisma.audit_logs.upsert({
    create: {
        // ... data to create a Audit_logs
    },
    update: {
        // ... in case it already exists, update
    },
    where: {
        // ... the filter for the Audit_logs we want to update
    }
});
```
