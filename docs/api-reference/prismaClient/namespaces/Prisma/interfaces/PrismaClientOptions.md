[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / PrismaClientOptions

# Interface: PrismaClientOptions

Defined in: generated/prisma/index.d.ts:3414

## Properties

### adapter?

> `optional` **adapter?**: `SqlDriverAdapterFactory` \| `null`

Defined in: generated/prisma/index.d.ts:3465

Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`

---

### datasources?

> `optional` **datasources?**: [`Datasources`](../type-aliases/Datasources.md)

Defined in: generated/prisma/index.d.ts:3418

Overwrites the datasource url from your schema.prisma file

---

### datasourceUrl?

> `optional` **datasourceUrl?**: `string`

Defined in: generated/prisma/index.d.ts:3422

Overwrites the datasource url from your schema.prisma file

---

### errorFormat?

> `optional` **errorFormat?**: [`ErrorFormat`](../type-aliases/ErrorFormat.md)

Defined in: generated/prisma/index.d.ts:3426

#### Default

```ts
'colorless';
```

---

### log?

> `optional` **log?**: ([`LogLevel`](../type-aliases/LogLevel.md) \| [`LogDefinition`](../type-aliases/LogDefinition.md))[]

Defined in: generated/prisma/index.d.ts:3451

#### Example

```
// Shorthand for `emit: 'stdout'`
log: ['query', 'info', 'warn', 'error']

// Emit as events only
log: [
  { emit: 'event', level: 'query' },
  { emit: 'event', level: 'info' },
  { emit: 'event', level: 'warn' }
  { emit: 'event', level: 'error' }
]

/ Emit as events and log to stdout
og: [
 { emit: 'stdout', level: 'query' },
 { emit: 'stdout', level: 'info' },
 { emit: 'stdout', level: 'warn' }
 { emit: 'stdout', level: 'error' }

```

Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).

---

### omit?

> `optional` **omit?**: [`GlobalOmitConfig`](../type-aliases/GlobalOmitConfig.md)

Defined in: generated/prisma/index.d.ts:3480

Global configuration for omitting model fields by default.

#### Example

```
const prisma = new PrismaClient({
  omit: {
    user: {
      password: true
    }
  }
})
```

---

### transactionOptions?

> `optional` **transactionOptions?**: `object`

Defined in: generated/prisma/index.d.ts:3457

The default values for transactionOptions
maxWait ?= 2000
timeout ?= 5000

#### isolationLevel?

> `optional` **isolationLevel?**: `"Serializable"`

#### maxWait?

> `optional` **maxWait?**: `number`

#### timeout?

> `optional` **timeout?**: `number`
