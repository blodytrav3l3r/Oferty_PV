/**
 * Schematy walidacji Zod dla serwerowego draftu (L2).
 *
 * Kontrakt: `payload` jest dowolnym obiektem JSON (kształt dokumentu należy do
 * modułu, nie do backendu), ale rozmiar jest liczony w bajtach UTF-8 po stronie
 * serwera. Limity są tu jedynym źródłem prawdy dla trasy.
 */
import { z } from 'zod';

/** Rodzaje dokumentów obsługiwane przez draft (spójne z draftStore.js). */
export const DRAFT_KINDS = ['offer_rury', 'order_rury', 'offer_studnie', 'order_studnie'] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

/** Limit payloadu: 256 KB (decyzja z review L2; 21× zmierzony max ≈ 11,8 KB). */
export const DRAFT_MAX_BYTES = 256 * 1024;

/** Limit liczby draftów na użytkownika (bez cichego usuwania nadmiaru). */
export const DRAFT_MAX_PER_USER = 50;

/** TTL draftu serwerowego. */
export const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** `docId` trafia do klucza i URL — tylko bezpieczny zestaw znaków. */
const docIdSchema = z
    .string()
    .min(1, 'ID dokumentu jest wymagane')
    .max(128, 'ID dokumentu jest zbyt długie')
    .regex(/^[A-Za-z0-9_-]+$/, 'ID dokumentu zawiera niedozwolone znaki');

export const draftParamsSchema = z.object({
    kind: z.enum(DRAFT_KINDS),
    docId: docIdSchema
});

export const draftPutBodySchema = z.object({
    baseVersion: z.number().int().min(1).nullable().optional(),
    // `unknown` celowo: kształt dokumentu należy do modułu. Walidujemy tylko
    // „jest obiektem" + rozmiar, żeby nie zgubić żadnego klucza payloadu.
    payload: z.unknown()
});

export type DraftParamsInput = z.infer<typeof draftParamsSchema>;
export type DraftPutBodyInput = z.infer<typeof draftPutBodySchema>;

/** Czy wartość jest zwykłym obiektem (nie tablica, nie null). */
export function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Rozmiar payloadu w bajtach UTF-8. Zwraca `null` gdy nie da się zserializować
 * (cykle, BigInt) — trasa odpowiada wtedy 400, nigdy cichym sukcesem.
 */
export function draftPayloadBytes(payload: unknown): number | null {
    try {
        const json = JSON.stringify(payload);
        if (typeof json !== 'string') return null;
        return Buffer.byteLength(json, 'utf8');
    } catch {
        return null;
    }
}

/**
 * Parsuje `kind`/`docId` z URL. Zwraca `null` dla niepoprawnych — trasa
 * odpowiada 400 bez ujawniania szczegółów wewnętrznych.
 */
export function parseDraftParams(kind: unknown, docId: unknown): DraftParamsInput | null {
    const parsed = draftParamsSchema.safeParse({ kind, docId });
    return parsed.success ? parsed.data : null;
}
