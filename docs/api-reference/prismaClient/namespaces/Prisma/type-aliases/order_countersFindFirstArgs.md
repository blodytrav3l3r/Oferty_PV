[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / order\_countersFindFirstArgs

# Type Alias: order\_countersFindFirstArgs\<ExtArgs\>

> **order\_countersFindFirstArgs**\<`ExtArgs`> \> = `object`

Defined in: generated/prisma/index.d.ts:19476

order_counters findFirst

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`order_countersWhereUniqueInput`](order_countersWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:19500

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for order_counters.

---

### distinct?

> `optional` **distinct?**: [`Order_countersScalarFieldEnum`](Order_countersScalarFieldEnum.md) \| [`Order_countersScalarFieldEnum`](Order_countersScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:19518

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of order_counters.

---

### omit?

> `optional` **omit?**: [`order_countersOmit`](order_countersOmit.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:19484

Omit specific fields from the order_counters

---

### orderBy?

> `optional` **orderBy?**: [`order_countersOrderByWithRelationInput`](order_countersOrderByWithRelationInput.md) \| [`order_countersOrderByWithRelationInput`](order_countersOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:19494

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of order_counters to fetch.

---

### select?

> `optional` **select?**: [`order_countersSelect`](order_countersSelect.md)\<`ExtArgs`> \> \| `null`

Defined in: generated/prisma/index.d.ts:19480

Select specific fields to fetch from the order_counters

---

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:19512

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` order_counters.

---

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:19506

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` order_counters from the position of the cursor.

---

### where?

> `optional` **where?**: [`order_countersWhereInput`](order_countersWhereInput.md)

Defined in: generated/prisma/index.d.ts:19488

Filter, which order_counters to fetch.
