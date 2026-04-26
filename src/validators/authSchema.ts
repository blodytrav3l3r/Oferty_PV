/**
 * Schematy walidacji Zod dla autentykacji i użytkowników
 *
 * @module validators/authSchema
 */

import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const loginSchema = z.object({
    username: z.string().min(3, 'Login musi mieć conajmniej 3 znaki'),
    password: z.string().min(4, 'Hasło jest za krótkie')
});

export const changePasswordSchema = z.object({
    oldPassword: z.string().min(4, 'Podaj stare hasło'),
    newPassword: z.string().min(6, 'Nowe hasło musi mieć przynajmniej 6 znaków')
});

export const registerSchema = z.object({
    username: z.string().min(3, 'Login musi mieć conajmniej 3 znaki'),
    password: z.string().min(6, 'Hasło musi mieć przynajmniej 6 znaków'),
    role: z.enum(['admin', 'user', 'pro']).optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email('Niepoprawny format email').optional().or(z.literal('')),
    symbol: z.string().optional(),
    subUsers: z.array(z.string()).optional(),
    orderStartNumber: z.union([z.string(), z.number()]).optional(),
    productionOrderStartNumber: z.union([z.string(), z.number()]).optional()
});

/**
 * Generyczny middleware Express walidujący dane wejściowe przy użyciu schematu Zod.
 *
 * Parsuje req.body zgodnie z podanym schematem. Jeśli walidacja się powiedzie,
 * przekazuje sterowanie do następnego middleware. W przeciwnym razie zwraca
 * odpowiedź 400 z pierwszym błędem walidacji oraz szczegółami wszystkich błędów.
 *
 * @param schema - Schemat Zod do walidacji danych wejściowych
 * @returns Middleware Express obsługujący walidację
 *
 * @example
 * ```ts
 * import { Router } from 'express';
 * import { validateData } from './validators/authSchema';
 * import { offerCreateSchema } from './validators/offerSchemas';
 *
 * const router = Router();
 *
 * // Walidacja POST /offers
 * router.post('/offers', validateData(offerCreateSchema), async (req, res) => {
 *   // req.body jest typowo bezpieczne
 *   const { clientId, items } = req.body;
 *   // ... obsługa żądania
 * });
 * ```
 */
export const validateData = (schema: z.ZodSchema<unknown>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            schema.parse(req.body);
            next();
        } catch (error: unknown) {
            if (error instanceof z.ZodError) {
                const firstError = error.issues[0];
                return res.status(400).json({
                    error: firstError?.message || 'Błąd walidacji danych wejściowych',
                    details: error.issues
                });
            }
            return res.status(500).json({ error: 'Błąd systemu' });
        }
    };
};
