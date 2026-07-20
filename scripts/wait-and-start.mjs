import waitOn from 'wait-on';
import { spawn } from 'child_process';

const BACKEND_URL = 'http://localhost:3000/api/health';
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
