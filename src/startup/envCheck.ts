import { z } from 'zod';

const envSchema = z.object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL jest wymagane'),
    DEFAULT_ADMIN_PASSWORD: z
        .string()
        .min(12, 'DEFAULT_ADMIN_PASSWORD musi mieć co najmniej 12 znaków')
        .optional(),
    PORT: z.string().regex(/^\d+$/, 'PORT musi być liczbą').optional().default('3000'),
    HOST: z.string().optional().default('0.0.0.0'),
    NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
    SENTRY_DSN: z.string().optional()
});

type EnvResult = z.infer<typeof envSchema>;

let _parsedEnv: EnvResult | null = null;

export function getParsedEnv(): EnvResult {
    if (!_parsedEnv) {
        throw new Error(
            'Środowisko nie zostało zweryfikowane — wywołaj validateEnv() przed startem'
        );
    }
    return _parsedEnv;
}

export async function validateEnv(): Promise<EnvResult> {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const issues = result.error.issues.map(
            (i) =>
                `  - ${i.path.join('.')}: ${i.message} (otrzymano: ${JSON.stringify(process.env[i.path.join('.') as keyof typeof process.env])})`
        );
        const msg = [
            '========================================',
            '  BŁĄD KRYTYCZNY — nieprawidłowa konfiguracja środowiska',
            '========================================',
            ...issues,
            '========================================'
        ].join('\n');

        console.error(msg);
        throw new Error(`Environment validation failed: ${result.error.issues.length} error(s)`);
    }

    _parsedEnv = result.data;
    return _parsedEnv;
}
