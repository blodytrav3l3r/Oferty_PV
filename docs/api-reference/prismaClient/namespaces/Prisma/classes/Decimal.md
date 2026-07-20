[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / Decimal

# Class: Decimal

Defined in: generated/prisma/runtime/library.d.ts:430

## Constructors

### Constructor

> **new Decimal**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:458

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

## Properties

### d

> `readonly` **d**: `number`[]

Defined in: generated/prisma/runtime/library.d.ts:454

***

### e

> `readonly` **e**: `number`

Defined in: generated/prisma/runtime/library.d.ts:455

***

### s

> `readonly` **s**: `number`

Defined in: generated/prisma/runtime/library.d.ts:456

***

### crypto

> `readonly` `static` **crypto**: `boolean`

Defined in: generated/prisma/runtime/library.d.ts:684

***

### Decimal?

> `readonly` `static` `optional` **Decimal?**: *typeof* [`Decimal`](../namespaces/Decimal/README.md)

Defined in: generated/prisma/runtime/library.d.ts:676

***

### default?

> `readonly` `static` `optional` **default?**: *typeof* [`Decimal`](../namespaces/Decimal/README.md)

Defined in: generated/prisma/runtime/library.d.ts:675

***

### EUCLID

> `readonly` `static` **EUCLID**: `9`

Defined in: generated/prisma/runtime/library.d.ts:696

***

### maxE

> `readonly` `static` **maxE**: `number`

Defined in: generated/prisma/runtime/library.d.ts:683

***

### minE

> `readonly` `static` **minE**: `number`

Defined in: generated/prisma/runtime/library.d.ts:682

***

### modulo

> `readonly` `static` **modulo**: [`Modulo`](../namespaces/Decimal/type-aliases/Modulo.md)

Defined in: generated/prisma/runtime/library.d.ts:685

***

### precision

> `readonly` `static` **precision**: `number`

Defined in: generated/prisma/runtime/library.d.ts:678

***

### ROUND\_CEIL

> `readonly` `static` **ROUND\_CEIL**: `2`

Defined in: generated/prisma/runtime/library.d.ts:689

***

### ROUND\_DOWN

> `readonly` `static` **ROUND\_DOWN**: `1`

Defined in: generated/prisma/runtime/library.d.ts:688

***

### ROUND\_FLOOR

> `readonly` `static` **ROUND\_FLOOR**: `3`

Defined in: generated/prisma/runtime/library.d.ts:690

***

### ROUND\_HALF\_CEIL

> `readonly` `static` **ROUND\_HALF\_CEIL**: `7`

Defined in: generated/prisma/runtime/library.d.ts:694

***

### ROUND\_HALF\_DOWN

> `readonly` `static` **ROUND\_HALF\_DOWN**: `5`

Defined in: generated/prisma/runtime/library.d.ts:692

***

### ROUND\_HALF\_EVEN

> `readonly` `static` **ROUND\_HALF\_EVEN**: `6`

Defined in: generated/prisma/runtime/library.d.ts:693

***

### ROUND\_HALF\_FLOOR

> `readonly` `static` **ROUND\_HALF\_FLOOR**: `8`

Defined in: generated/prisma/runtime/library.d.ts:695

***

### ROUND\_HALF\_UP

> `readonly` `static` **ROUND\_HALF\_UP**: `4`

Defined in: generated/prisma/runtime/library.d.ts:691

***

### ROUND\_UP

> `readonly` `static` **ROUND\_UP**: `0`

Defined in: generated/prisma/runtime/library.d.ts:687

***

### rounding

> `readonly` `static` **rounding**: [`Rounding`](../namespaces/Decimal/type-aliases/Rounding.md)

Defined in: generated/prisma/runtime/library.d.ts:679

***

### toExpNeg

> `readonly` `static` **toExpNeg**: `number`

Defined in: generated/prisma/runtime/library.d.ts:680

***

### toExpPos

> `readonly` `static` **toExpPos**: `number`

Defined in: generated/prisma/runtime/library.d.ts:681

## Methods

### abs()

> **abs**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:461

#### Returns

`Decimal`

***

### absoluteValue()

> **absoluteValue**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:460

#### Returns

`Decimal`

***

### acos()

> **acos**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:507

#### Returns

`Decimal`

***

### acosh()

> **acosh**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:510

#### Returns

`Decimal`

***

### add()

> **add**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:564

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### asin()

> **asin**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:519

#### Returns

`Decimal`

***

### asinh()

> **asinh**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:513

#### Returns

`Decimal`

***

### atan()

> **atan**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:522

#### Returns

`Decimal`

***

### atanh()

> **atanh**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:516

#### Returns

`Decimal`

***

### cbrt()

> **cbrt**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:475

#### Returns

`Decimal`

***

### ceil()

> **ceil**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:463

#### Returns

`Decimal`

***

### clamp()

> **clamp**(`min`, `max`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:466

#### Parameters

##### min

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

##### max

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### clampedTo()

> **clampedTo**(`min`, `max`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:465

#### Parameters

##### min

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

##### max

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### cmp()

> **cmp**(`n`): `number`

Defined in: generated/prisma/runtime/library.d.ts:469

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`number`

***

### comparedTo()

> **comparedTo**(`n`): `number`

Defined in: generated/prisma/runtime/library.d.ts:468

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`number`

***

### cos()

> **cos**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:472

#### Returns

`Decimal`

***

### cosh()

> **cosh**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:498

#### Returns

`Decimal`

***

### cosine()

> **cosine**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:471

#### Returns

`Decimal`

***

### cubeRoot()

> **cubeRoot**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:474

#### Returns

`Decimal`

***

### decimalPlaces()

> **decimalPlaces**(): `number`

Defined in: generated/prisma/runtime/library.d.ts:477

#### Returns

`number`

***

### div()

> **div**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:481

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### dividedBy()

> **dividedBy**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:480

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### dividedToIntegerBy()

> **dividedToIntegerBy**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:483

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### divToInt()

> **divToInt**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:484

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### dp()

> **dp**(): `number`

Defined in: generated/prisma/runtime/library.d.ts:478

#### Returns

`number`

***

### eq()

> **eq**(`n`): `boolean`

Defined in: generated/prisma/runtime/library.d.ts:487

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`boolean`

***

### equals()

> **equals**(`n`): `boolean`

Defined in: generated/prisma/runtime/library.d.ts:486

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`boolean`

***

### exp()

> **exp**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:555

#### Returns

`Decimal`

***

### floor()

> **floor**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:489

#### Returns

`Decimal`

***

### greaterThan()

> **greaterThan**(`n`): `boolean`

Defined in: generated/prisma/runtime/library.d.ts:491

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`boolean`

***

### greaterThanOrEqualTo()

> **greaterThanOrEqualTo**(`n`): `boolean`

Defined in: generated/prisma/runtime/library.d.ts:494

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`boolean`

***

### gt()

> **gt**(`n`): `boolean`

Defined in: generated/prisma/runtime/library.d.ts:492

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`boolean`

***

### gte()

> **gte**(`n`): `boolean`

Defined in: generated/prisma/runtime/library.d.ts:495

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`boolean`

***

### hyperbolicCosine()

> **hyperbolicCosine**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:497

#### Returns

`Decimal`

***

### hyperbolicSine()

> **hyperbolicSine**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:500

#### Returns

`Decimal`

***

### hyperbolicTangent()

> **hyperbolicTangent**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:503

#### Returns

`Decimal`

***

### inverseCosine()

> **inverseCosine**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:506

#### Returns

`Decimal`

***

### inverseHyperbolicCosine()

> **inverseHyperbolicCosine**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:509

#### Returns

`Decimal`

***

### inverseHyperbolicSine()

> **inverseHyperbolicSine**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:512

#### Returns

`Decimal`

***

### inverseHyperbolicTangent()

> **inverseHyperbolicTangent**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:515

#### Returns

`Decimal`

***

### inverseSine()

> **inverseSine**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:518

#### Returns

`Decimal`

***

### inverseTangent()

> **inverseTangent**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:521

#### Returns

`Decimal`

***

### isFinite()

> **isFinite**(): `boolean`

Defined in: generated/prisma/runtime/library.d.ts:524

#### Returns

`boolean`

***

### isInt()

> **isInt**(): `boolean`

Defined in: generated/prisma/runtime/library.d.ts:527

#### Returns

`boolean`

***

### isInteger()

> **isInteger**(): `boolean`

Defined in: generated/prisma/runtime/library.d.ts:526

#### Returns

`boolean`

***

### isNaN()

> **isNaN**(): `boolean`

Defined in: generated/prisma/runtime/library.d.ts:529

#### Returns

`boolean`

***

### isNeg()

> **isNeg**(): `boolean`

Defined in: generated/prisma/runtime/library.d.ts:532

#### Returns

`boolean`

***

### isNegative()

> **isNegative**(): `boolean`

Defined in: generated/prisma/runtime/library.d.ts:531

#### Returns

`boolean`

***

### isPos()

> **isPos**(): `boolean`

Defined in: generated/prisma/runtime/library.d.ts:535

#### Returns

`boolean`

***

### isPositive()

> **isPositive**(): `boolean`

Defined in: generated/prisma/runtime/library.d.ts:534

#### Returns

`boolean`

***

### isZero()

> **isZero**(): `boolean`

Defined in: generated/prisma/runtime/library.d.ts:537

#### Returns

`boolean`

***

### lessThan()

> **lessThan**(`n`): `boolean`

Defined in: generated/prisma/runtime/library.d.ts:539

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`boolean`

***

### lessThanOrEqualTo()

> **lessThanOrEqualTo**(`n`): `boolean`

Defined in: generated/prisma/runtime/library.d.ts:542

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`boolean`

***

### ln()

> **ln**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:558

#### Returns

`Decimal`

***

### log()

> **log**(`n?`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:546

#### Parameters

##### n?

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### logarithm()

> **logarithm**(`n?`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:545

#### Parameters

##### n?

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### lt()

> **lt**(`n`): `boolean`

Defined in: generated/prisma/runtime/library.d.ts:540

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`boolean`

***

### lte()

> **lte**(`n`): `boolean`

Defined in: generated/prisma/runtime/library.d.ts:543

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`boolean`

***

### minus()

> **minus**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:548

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### mod()

> **mod**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:552

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### modulo()

> **modulo**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:551

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### mul()

> **mul**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:581

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### naturalExponential()

> **naturalExponential**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:554

#### Returns

`Decimal`

***

### naturalLogarithm()

> **naturalLogarithm**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:557

#### Returns

`Decimal`

***

### neg()

> **neg**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:561

#### Returns

`Decimal`

***

### negated()

> **negated**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:560

#### Returns

`Decimal`

***

### plus()

> **plus**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:563

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### pow()

> **pow**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:614

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### precision()

> **precision**(`includeZeros?`): `number`

Defined in: generated/prisma/runtime/library.d.ts:566

#### Parameters

##### includeZeros?

`boolean`

#### Returns

`number`

***

### round()

> **round**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:569

#### Returns

`Decimal`

***

### sd()

> **sd**(`includeZeros?`): `number`

Defined in: generated/prisma/runtime/library.d.ts:567

#### Parameters

##### includeZeros?

`boolean`

#### Returns

`number`

***

### sin()

> **sin**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:572

#### Returns

`Decimal`

***

### sine()

> **sine**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:571

#### Returns

`Decimal`

***

### sinh()

> **sinh**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:501

#### Returns

`Decimal`

***

### sqrt()

> **sqrt**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:575

#### Returns

`Decimal`

***

### squareRoot()

> **squareRoot**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:574

#### Returns

`Decimal`

***

### sub()

> **sub**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:549

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### tan()

> **tan**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:578

#### Returns

`Decimal`

***

### tangent()

> **tangent**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:577

#### Returns

`Decimal`

***

### tanh()

> **tanh**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:504

#### Returns

`Decimal`

***

### times()

> **times**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:580

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### toBinary()

#### Call Signature

> **toBinary**(`significantDigits?`): `string`

Defined in: generated/prisma/runtime/library.d.ts:583

##### Parameters

###### significantDigits?

`number`

##### Returns

`string`

#### Call Signature

> **toBinary**(`significantDigits`, `rounding`): `string`

Defined in: generated/prisma/runtime/library.d.ts:584

##### Parameters

###### significantDigits

`number`

###### rounding

[`Rounding`](../namespaces/Decimal/type-aliases/Rounding.md)

##### Returns

`string`

***

### toDecimalPlaces()

#### Call Signature

> **toDecimalPlaces**(`decimalPlaces?`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:586

##### Parameters

###### decimalPlaces?

`number`

##### Returns

`Decimal`

#### Call Signature

> **toDecimalPlaces**(`decimalPlaces`, `rounding`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:587

##### Parameters

###### decimalPlaces

`number`

###### rounding

[`Rounding`](../namespaces/Decimal/type-aliases/Rounding.md)

##### Returns

`Decimal`

***

### toDP()

#### Call Signature

> **toDP**(`decimalPlaces?`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:588

##### Parameters

###### decimalPlaces?

`number`

##### Returns

`Decimal`

#### Call Signature

> **toDP**(`decimalPlaces`, `rounding`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:589

##### Parameters

###### decimalPlaces

`number`

###### rounding

[`Rounding`](../namespaces/Decimal/type-aliases/Rounding.md)

##### Returns

`Decimal`

***

### toExponential()

#### Call Signature

> **toExponential**(`decimalPlaces?`): `string`

Defined in: generated/prisma/runtime/library.d.ts:591

##### Parameters

###### decimalPlaces?

`number`

##### Returns

`string`

#### Call Signature

> **toExponential**(`decimalPlaces`, `rounding`): `string`

Defined in: generated/prisma/runtime/library.d.ts:592

##### Parameters

###### decimalPlaces

`number`

###### rounding

[`Rounding`](../namespaces/Decimal/type-aliases/Rounding.md)

##### Returns

`string`

***

### toFixed()

#### Call Signature

> **toFixed**(`decimalPlaces?`): `string`

Defined in: generated/prisma/runtime/library.d.ts:594

##### Parameters

###### decimalPlaces?

`number`

##### Returns

`string`

#### Call Signature

> **toFixed**(`decimalPlaces`, `rounding`): `string`

Defined in: generated/prisma/runtime/library.d.ts:595

##### Parameters

###### decimalPlaces

`number`

###### rounding

[`Rounding`](../namespaces/Decimal/type-aliases/Rounding.md)

##### Returns

`string`

***

### toFraction()

> **toFraction**(`max_denominator?`): `Decimal`[]

Defined in: generated/prisma/runtime/library.d.ts:597

#### Parameters

##### max\_denominator?

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`[]

***

### toHex()

#### Call Signature

> **toHex**(`significantDigits?`): `string`

Defined in: generated/prisma/runtime/library.d.ts:601

##### Parameters

###### significantDigits?

`number`

##### Returns

`string`

#### Call Signature

> **toHex**(`significantDigits`, `rounding?`): `string`

Defined in: generated/prisma/runtime/library.d.ts:602

##### Parameters

###### significantDigits

`number`

###### rounding?

[`Rounding`](../namespaces/Decimal/type-aliases/Rounding.md)

##### Returns

`string`

***

### toHexadecimal()

#### Call Signature

> **toHexadecimal**(`significantDigits?`): `string`

Defined in: generated/prisma/runtime/library.d.ts:599

##### Parameters

###### significantDigits?

`number`

##### Returns

`string`

#### Call Signature

> **toHexadecimal**(`significantDigits`, `rounding`): `string`

Defined in: generated/prisma/runtime/library.d.ts:600

##### Parameters

###### significantDigits

`number`

###### rounding

[`Rounding`](../namespaces/Decimal/type-aliases/Rounding.md)

##### Returns

`string`

***

### toJSON()

> **toJSON**(): `string`

Defined in: generated/prisma/runtime/library.d.ts:604

#### Returns

`string`

***

### toNearest()

> **toNearest**(`n`, `rounding?`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:606

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

##### rounding?

[`Rounding`](../namespaces/Decimal/type-aliases/Rounding.md)

#### Returns

`Decimal`

***

### toNumber()

> **toNumber**(): `number`

Defined in: generated/prisma/runtime/library.d.ts:608

#### Returns

`number`

***

### toOctal()

#### Call Signature

> **toOctal**(`significantDigits?`): `string`

Defined in: generated/prisma/runtime/library.d.ts:610

##### Parameters

###### significantDigits?

`number`

##### Returns

`string`

#### Call Signature

> **toOctal**(`significantDigits`, `rounding`): `string`

Defined in: generated/prisma/runtime/library.d.ts:611

##### Parameters

###### significantDigits

`number`

###### rounding

[`Rounding`](../namespaces/Decimal/type-aliases/Rounding.md)

##### Returns

`string`

***

### toPower()

> **toPower**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:613

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### toPrecision()

#### Call Signature

> **toPrecision**(`significantDigits?`): `string`

Defined in: generated/prisma/runtime/library.d.ts:616

##### Parameters

###### significantDigits?

`number`

##### Returns

`string`

#### Call Signature

> **toPrecision**(`significantDigits`, `rounding`): `string`

Defined in: generated/prisma/runtime/library.d.ts:617

##### Parameters

###### significantDigits

`number`

###### rounding

[`Rounding`](../namespaces/Decimal/type-aliases/Rounding.md)

##### Returns

`string`

***

### toSD()

#### Call Signature

> **toSD**(`significantDigits?`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:621

##### Parameters

###### significantDigits?

`number`

##### Returns

`Decimal`

#### Call Signature

> **toSD**(`significantDigits`, `rounding`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:622

##### Parameters

###### significantDigits

`number`

###### rounding

[`Rounding`](../namespaces/Decimal/type-aliases/Rounding.md)

##### Returns

`Decimal`

***

### toSignificantDigits()

#### Call Signature

> **toSignificantDigits**(`significantDigits?`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:619

##### Parameters

###### significantDigits?

`number`

##### Returns

`Decimal`

#### Call Signature

> **toSignificantDigits**(`significantDigits`, `rounding`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:620

##### Parameters

###### significantDigits

`number`

###### rounding

[`Rounding`](../namespaces/Decimal/type-aliases/Rounding.md)

##### Returns

`Decimal`

***

### toString()

> **toString**(): `string`

Defined in: generated/prisma/runtime/library.d.ts:624

#### Returns

`string`

***

### trunc()

> **trunc**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:627

#### Returns

`Decimal`

***

### truncated()

> **truncated**(): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:626

#### Returns

`Decimal`

***

### valueOf()

> **valueOf**(): `string`

Defined in: generated/prisma/runtime/library.d.ts:629

#### Returns

`string`

***

### abs()

> `static` **abs**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:631

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### acos()

> `static` **acos**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:632

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### acosh()

> `static` **acosh**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:633

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### add()

> `static` **add**(`x`, `y`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:634

#### Parameters

##### x

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

##### y

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### asin()

> `static` **asin**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:635

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### asinh()

> `static` **asinh**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:636

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### atan()

> `static` **atan**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:637

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### atan2()

> `static` **atan2**(`y`, `x`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:639

#### Parameters

##### y

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

##### x

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### atanh()

> `static` **atanh**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:638

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### cbrt()

> `static` **cbrt**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:640

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### ceil()

> `static` **ceil**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:641

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### clamp()

> `static` **clamp**(`n`, `min`, `max`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:642

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

##### min

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

##### max

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### clone()

> `static` **clone**(`object?`): *typeof* [`Decimal`](../namespaces/Decimal/README.md)

Defined in: generated/prisma/runtime/library.d.ts:643

#### Parameters

##### object?

[`Config`](../namespaces/Decimal/interfaces/Config.md)

#### Returns

*typeof* [`Decimal`](../namespaces/Decimal/README.md)

***

### config()

> `static` **config**(`object`): *typeof* [`Decimal`](../namespaces/Decimal/README.md)

Defined in: generated/prisma/runtime/library.d.ts:644

#### Parameters

##### object

[`Config`](../namespaces/Decimal/interfaces/Config.md)

#### Returns

*typeof* [`Decimal`](../namespaces/Decimal/README.md)

***

### cos()

> `static` **cos**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:645

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### cosh()

> `static` **cosh**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:646

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### div()

> `static` **div**(`x`, `y`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:647

#### Parameters

##### x

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

##### y

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### exp()

> `static` **exp**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:648

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### floor()

> `static` **floor**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:649

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### hypot()

> `static` **hypot**(...`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:650

#### Parameters

##### n

...[`Value`](../namespaces/Decimal/type-aliases/Value.md)[]

#### Returns

`Decimal`

***

### isDecimal()

> `static` **isDecimal**(`object`): `object is Decimal`

Defined in: generated/prisma/runtime/library.d.ts:651

#### Parameters

##### object

`any`

#### Returns

`object is Decimal`

***

### ln()

> `static` **ln**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:652

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### log()

> `static` **log**(`n`, `base?`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:653

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

##### base?

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### log10()

> `static` **log10**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:655

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### log2()

> `static` **log2**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:654

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### max()

> `static` **max**(...`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:656

#### Parameters

##### n

...[`Value`](../namespaces/Decimal/type-aliases/Value.md)[]

#### Returns

`Decimal`

***

### min()

> `static` **min**(...`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:657

#### Parameters

##### n

...[`Value`](../namespaces/Decimal/type-aliases/Value.md)[]

#### Returns

`Decimal`

***

### mod()

> `static` **mod**(`x`, `y`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:658

#### Parameters

##### x

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

##### y

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### mul()

> `static` **mul**(`x`, `y`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:659

#### Parameters

##### x

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

##### y

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### noConflict()

> `static` **noConflict**(): *typeof* [`Decimal`](../namespaces/Decimal/README.md)

Defined in: generated/prisma/runtime/library.d.ts:660

#### Returns

*typeof* [`Decimal`](../namespaces/Decimal/README.md)

***

### pow()

> `static` **pow**(`base`, `exponent`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:661

#### Parameters

##### base

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

##### exponent

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### random()

> `static` **random**(`significantDigits?`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:662

#### Parameters

##### significantDigits?

`number`

#### Returns

`Decimal`

***

### round()

> `static` **round**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:663

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### set()

> `static` **set**(`object`): *typeof* [`Decimal`](../namespaces/Decimal/README.md)

Defined in: generated/prisma/runtime/library.d.ts:664

#### Parameters

##### object

[`Config`](../namespaces/Decimal/interfaces/Config.md)

#### Returns

*typeof* [`Decimal`](../namespaces/Decimal/README.md)

***

### sign()

> `static` **sign**(`n`): `number`

Defined in: generated/prisma/runtime/library.d.ts:665

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`number`

***

### sin()

> `static` **sin**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:666

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### sinh()

> `static` **sinh**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:667

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### sqrt()

> `static` **sqrt**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:668

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### sub()

> `static` **sub**(`x`, `y`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:669

#### Parameters

##### x

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

##### y

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### sum()

> `static` **sum**(...`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:670

#### Parameters

##### n

...[`Value`](../namespaces/Decimal/type-aliases/Value.md)[]

#### Returns

`Decimal`

***

### tan()

> `static` **tan**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:671

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### tanh()

> `static` **tanh**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:672

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`

***

### trunc()

> `static` **trunc**(`n`): `Decimal`

Defined in: generated/prisma/runtime/library.d.ts:673

#### Parameters

##### n

[`Value`](../namespaces/Decimal/type-aliases/Value.md)

#### Returns

`Decimal`
