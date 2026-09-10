/**
 * Schematy walidacji Zod dla twardej blokady edycji (doc_locks).
 */
import { z } from 'zod';
import { DOC_LOCK_TYPES } from '../utils/docLocks';

export const docLockBodySchema = z.object({
    docType: z.enum(DOC_LOCK_TYPES),
    docId: z.string().min(1, 'ID dokumentu jest wymagane')
});

export const docLockParamsSchema = z.object({
    docType: z.enum(DOC_LOCK_TYPES),
    docId: z.string().min(1, 'ID dokumentu jest wymagane')
});

export type DocLockBodyInput = z.infer<typeof docLockBodySchema>;
