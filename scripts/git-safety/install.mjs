#!/usr/bin/env node
/**
 * Instaluje Git Safety wrapper do .git/safety/bin i instruuje o PATH
 * Uruchom: node scripts/git-safety/install.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SRC_DIR = path.join(ROOT, 'scripts', 'git-safety', 'wrapper');
const DST_DIR = path.join(ROOT, '.git', 'safety', 'bin');

fs.mkdirSync(DST_DIR, { recursive: true });
for (const name of ['git', 'git.cmd']) {
    const src = path.join(SRC_DIR, name);
    const dst = path.join(DST_DIR, name);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
        console.log(`Installed ${dst}`);
        if (name === 'git') {
            try {
                fs.chmodSync(dst, 0o755);
            } catch {}
        }
    }
}
console.log('\nAby włączyć guard, dodaj do PATH przed systemowym gitem:');
console.log(`  ${DST_DIR}`);
console.log('\nPowerShell: $env:PATH = "' + DST_DIR + ';"+$env:PATH');
console.log('Git Bash:   export PATH="' + DST_DIR.replace(/\\/g, '/') + ':$PATH"');
console.log('Node:       process.env.PATH = "' + DST_DIR + ';" + process.env.PATH');
