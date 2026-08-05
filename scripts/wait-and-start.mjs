import waitOn from 'wait-on';
import { spawn } from 'child_process';

const PORT = process.env.PORT || '3000';
const BACKEND_URL = 'http://localhost:' + PORT + '/health';
const TIMEOUT_MS = 30000;
const INTERVAL_MS = 500;

let shuttingDown = false;
let child = null;

function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    if (child && !child.killed) {
        child.kill(signal);
    }
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function main() {
    try {
        await waitOn({ resources: [BACKEND_URL], timeout: TIMEOUT_MS, interval: INTERVAL_MS, verbose: false });
        console.log('[OK] Backend odpowiada, uruchamiam Vite...');
    } catch (err) {
        console.warn(
            '[WARN] Backend nie odpowiada po ' + TIMEOUT_MS / 1000 + 's, uruchamiam Vite mimo to...'
        );
        console.warn('  ' + err.message);
    }

    child = spawn('npm', ['run', 'dev:frontend'], { stdio: 'inherit', shell: true });
    child.on('exit', (code) => {
        if (!shuttingDown) process.exit(code ?? 1);
    });
}

main();