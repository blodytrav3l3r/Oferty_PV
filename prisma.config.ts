import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '.env') });

import { defineConfig } from 'prisma/config';

export default defineConfig({
    migrations: {
        seed: 'ts-node prisma/seed.ts'
    }
});
