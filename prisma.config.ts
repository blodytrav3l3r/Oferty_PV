import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations-postgresql',
        seed: 'node -r ts-node/register prisma/seed.ts'
    },
    datasource: {
        url: env('DATABASE_URL')
    }
});
