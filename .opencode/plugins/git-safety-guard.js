// Git Safety guard — OpenCode V2 permission hook.
//
// Repo wrapper (scripts/git-safety/wrapper) działa tylko wtedy, gdy `git` w PATH
// wskazuje na wrapper. Dziś `Get-Command git` daje systemowy git.exe, więc wrapper
// jest nieaktywny, a `git.exe`, ścieżki bezwzględne i `git -c ...` omijają go
// (docs/development/GIT_SAFETY.md, sekcja bypassów).
//
// Hook czyta tekst komendy powłoki, więc pokrywa też bypass. Efekt `ask`, nigdy
// `deny`: operacja destrukcyjna w gicie wymaga jawnej zgody człowieka
// (docs/AUTONOMY_CONTRACT.md, Tier 🔴), a nie jest zakazana.
//
// Tylko V2 (ctx.permission.hook). V1 nie ma odpowiednika tego hooka.
import { pathToFileURL } from 'node:url';

const GIT = /^(?:.*[\\/])?git(?:\.exe)?$/i;
const GIT_GLOBAL_WITH_VALUE = new Set([
    '-c',
    '-C',
    '--git-dir',
    '--work-tree',
    '--namespace',
    '--exec-path'
]);
const STAGED_ONLY = new Set(['--staged', '-S', '--help', '-h']);
const WRAPPERS = new Set([
    'sudo',
    'env',
    'time',
    'command',
    'xargs',
    'cmd',
    'powershell',
    'pwsh',
    'bash',
    'sh'
]);

const stripQuotes = (token) => token.replace(/^["']|["']$/g, '');
const isDryRun = (args) => args.some((a) => a === '--dry-run' || /^-[a-z]*n/.test(a));

/** Zwraca nazwy operacji Tier A znalezionych w tekście komendy. */
export function findTierA(command) {
    const hits = [];
    for (const segment of command.split(/[;&|\n]+/)) {
        const tokens = segment.trim().split(/\s+/).filter(Boolean).map(stripQuotes);
        // Git musi być komendą segmentu (albo stać za wrapperem), nie słowem w argumencie.
        const gitIndex = tokens.findIndex(
            (token, index) => GIT.test(token) && (index === 0 || WRAPPERS.has(tokens[index - 1]))
        );
        if (gitIndex === -1) continue;

        let i = gitIndex + 1;
        while (i < tokens.length && tokens[i].startsWith('-')) {
            i += GIT_GLOBAL_WITH_VALUE.has(tokens[i]) ? 2 : 1;
        }
        const sub = tokens[i];
        const args = tokens.slice(i + 1);
        if (!sub) continue;

        if (sub === 'reset' && args.includes('--hard')) hits.push('reset --hard');
        else if (
            sub === 'clean' &&
            !isDryRun(args) &&
            args.some((a) => /^-[a-z]*f/i.test(a) || a === '--force')
        ) {
            hits.push('clean -f');
        } else if (sub === 'checkout' && args.includes('--')) hits.push('checkout --');
        else if (sub === 'restore' && !args.some((a) => STAGED_ONLY.has(a))) hits.push('restore');
    }
    return hits;
}

export default {
    id: 'sok-git-safety-guard',

    async setup(ctx) {
        await ctx.permission.hook('evaluate', (event) => {
            if (event.action !== 'shell' || event.effect === 'deny') return;

            const hits = event.resources.flatMap((resource) => findTierA(String(resource)));
            if (hits.length === 0) return;

            event.effect = 'ask';
            event.message = `[Git Safety] Operacja Tier A: ${[...new Set(hits)].join(', ')}. Wrapper git nie jest w PATH — hook pyta o zgodę. Procedura: docs/development/GIT_SAFETY.md (snapshot -> verify -> --force).`;
        });
    }
};

// Self-check: node .opencode/plugins/git-safety-guard.js
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const { deepStrictEqual } = await import('node:assert');
    const cases = [
        ['git reset --hard HEAD~1', ['reset --hard']],
        ['cd repo && git clean -fdx', ['clean -f']],
        ['git checkout -- public/js/app.js', ['checkout --']],
        ['git restore --staged .', []],
        ['git restore public/css/rury.css', ['restore']],
        ['git.exe reset --hard', ['reset --hard']],
        ['git -c core.hooksPath=/dev/null reset --hard', ['reset --hard']],
        ['git clean -n', []],
        ['git status --short', []],
        ['git commit -m "fix: reset --hard guard"', []],
        ['echo "git reset --hard"', []],
        ['npm run git:safety:verify', []]
    ];
    for (const [command, expected] of cases) deepStrictEqual(findTierA(command), expected, command);
    console.log(`[git-safety-guard] self-check OK (${cases.length} przypadków)`);
}
