import { readFileSync } from 'fs';
import { resolve } from 'path';

const publicDir = resolve(import.meta.dirname, '../public');
const htmlFiles = ['app.html', 'index.html', 'rury.html', 'studnie.html', 'kartoteka.html', 'zlecenia.html'];

// eslint-disable-next-line no-control-regex
const INLINE_RE = /\son(?:click|change|input|blur|focus|mouse(?:enter|leave|over|out)|keydown|drag(?:start|over|end|drop)?|submit|load|error|scroll|toggle|animation|transition|cut|copy|paste|wheel|contextmenu|dblclick|select|reset|search|gotpointercapture|lostpointercapture|pointer(?:down|move|up|cancel|enter|leave|over|out))=(?:"[^"]*"|'[^']*')/gi;

let exitCode = 0;

for (const file of htmlFiles) {
  const fp = resolve(publicDir, file);
  try {
    const content = readFileSync(fp, 'utf-8');
    const matches = [...content.matchAll(INLINE_RE)];
    if (matches.length > 0) {
      console.error(`[FAIL] ${file}: ${matches.length} inline event handler(s) found`);
      for (const m of matches.slice(0, 5)) {
        console.error(`  → ${m[0].trim().substring(0, 100)}`);
      }
      exitCode = 1;
    }
  } catch { /* skip missing files */ }
}

if (exitCode === 0) {
  console.log('[PASS] No inline event handlers in any HTML file');
}

process.exit(exitCode);
