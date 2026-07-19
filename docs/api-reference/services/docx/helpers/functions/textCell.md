[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [services/docx/helpers](../README.md) / textCell

# Function: textCell()

> **textCell**(`text`, `opts?`): `TableCell`

Defined in: [src/services/docx/helpers.ts:28](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/docx/helpers.ts#L28)

Tworzy komórkę tabeli z tekstem — reużywalny helper

## Parameters

### text

`string`

### opts?

#### alignment?

`"start"` \| `"center"` \| `"end"` \| `"both"` \| `"mediumKashida"` \| `"distribute"` \| `"numTab"` \| `"highKashida"` \| `"lowKashida"` \| `"thaiDistribute"` \| `"left"` \| `"right"`

#### bold?

`boolean`

#### borders?

[`CellBorders`](../../constants/type-aliases/CellBorders.md)

#### color?

`string`

#### columnSpan?

`number`

#### fill?

`string`

#### size?

`number`

#### width?

`number`

## Returns

`TableCell`
