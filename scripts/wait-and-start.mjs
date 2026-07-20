import waitOn from 'wait-on';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');
let PORT = 3000;
try {
    const env = readFileSync(envPath, 'utf-8');
    const match = env.match(/^PORT\s*=\s*(\d+)/m);
    if (match) PORT = parseInt(match[1], 10);
} catch { /* domyslnie 3000 */ }
const BACKEND_URL = `http://localhost:${PORT}/api/health`;
const TIMEOUT_MS = 60000;

async function main() {
    try {
        await waitOn({ resources: [BACKEND_URL], timeout: TIMEOUT_MS, verbose: false });
        console.log('[OK] Backend odpowiada, uruchamiam Vite...');
    } catch (err) {
        console.warn(
            '[WARN] Backend nie odpowiada po ' + TIMEOUT_MS / 1000 + 's, uruchamiam Vite mimo to...'
        );
        console.warn('  ' + err.message);
    }

    const child = spawn('npx', ['vite'], { stdio: 'inherit', shell: true });
    child.on('exit', (code) => process.exit(code ?? 1));
}

main();
