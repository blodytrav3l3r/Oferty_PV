[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / PrismaClientKnownRequestError

# Class: PrismaClientKnownRequestError

Defined in: generated/prisma/runtime/library.d.ts:2626

## Extends

- `Error`

## Implements

- `ErrorWithBatchIndex`

## Constructors

### Constructor

> **new PrismaClientKnownRequestError**(`message`, `__namedParameters`): `PrismaClientKnownRequestError`

Defined in: generated/prisma/runtime/library.d.ts:2631

#### Parameters

##### message

`string`

##### \_\_namedParameters

`KnownErrorParams`

#### Returns

`PrismaClientKnownRequestError`

#### Overrides

`Error.constructor`

## Properties

### batchRequestIdx?

> `optional` **batchRequestIdx?**: `number`

Defined in: generated/prisma/runtime/library.d.ts:2630

#### Implementation of

`ErrorWithBatchIndex.batchRequestIdx`

---

### clientVersion

> **clientVersion**: `string`

Defined in: generated/prisma/runtime/library.d.ts:2629

---

### code

> **code**: `string`

Defined in: generated/prisma/runtime/library.d.ts:2627

---

### meta?

> `optional` **meta?**: `Record`\<`string`, `unknown`>\>

Defined in: generated/prisma/runtime/library.d.ts:2628

## Accessors

### \[toStringTag\]

#### Get Signature

> **get** **\[toStringTag\]**(): `string`

Defined in: generated/prisma/runtime/library.d.ts:2632

##### Returns

`string`
