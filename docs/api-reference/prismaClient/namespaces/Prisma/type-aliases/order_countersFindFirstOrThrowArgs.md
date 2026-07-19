[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / order\_countersFindFirstOrThrowArgs

# Type Alias: order\_countersFindFirstOrThrowArgs\<ExtArgs\>

> **order\_countersFindFirstOrThrowArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:19524

order_counters findFirstOrThrow

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`order_countersWhereUniqueInput`](order_countersWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:19548

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for order_counters.

---

### distinct?

> `optional` **distinct?**: [`Order_countersScalarFieldEnum`](Order_countersScalarFieldEnum.md) \| [`Order_countersScalarFieldEnum`](Order_countersScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:19566

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of order_counters.

---

### omit?

> `optional` **omit?**: [`order_countersOmit`](order_countersOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:19532

Omit specific fields from the order_counters

---

### orderBy?

> `optional` **orderBy?**: [`order_countersOrderByWithRelationInput`](order_countersOrderByWithRelationInput.md) \| [`order_countersOrderByWithRelationInput`](order_countersOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:19542

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of order_counters to fetch.

---

### select?

> `optional` **select?**: [`order_countersSelect`](order_countersSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:19528

Select specific fields to fetch from the order_counters

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:19560

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` order_counters.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:19554

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` order_counters from the position of the cursor.

---

### where?

> `optional` **where?**: [`order_countersWhereInput`](order_countersWhereInput.md)

Defined in: generated/prisma/index.d.ts:19536

Filter, which order_counters to fetch.
