[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/authSchema](../README.md) / validateData

# Function: validateData()

> **validateData**(`schema`): (`req`, `res`, `next`) => `Response`\<`any`, `Record`\<`string`, `any`>> \>\> \| `undefined`

Defined in: [src/validators/authSchema.ts:60](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/validators/authSchema.ts#L60)

Generyczny middleware Express walidujący dane wejściowe przy użyciu schematu Zod.

Parsuje req.body zgodnie z podanym schematem. Jeśli walidacja się powiedzie,
przekazuje sterowanie do następnego middleware. W przeciwnym razie zwraca
odpowiedź 400 z pierwszym błędem walidacji oraz szczegółami wszystkich błędów.

## Parameters

### schema

`ZodType`\<`unknown`\>

Schemat Zod do walidacji danych wejściowych

## Returns

Middleware Express obsługujący walidację

(`req`, `res`, `next`) => `Response`\<`any`, `Record`\<`string`, `any`\>\> \| `undefined`

## Example

```ts
import { Router } from 'express';
import { validateData } from './validators/authSchema';
import { offerCreateSchema } from './validators/offerSchemas';

const router = Router();

// Walidacja POST /offers
router.post('/offers', validateData(offerCreateSchema), async (req, res) => {
    // req.body jest typowo bezpieczne
    const { clientId, items } = req.body;
    // ... obsługa żądania
});
```
