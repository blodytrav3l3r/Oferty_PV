#!/usr/bin/env node
/**
 * Etap 4 — Klasyfikacja operacji Git (Tier A/B)
 * Parsuje rzeczywiste args, nie literalny tekst
 */
export function parseOperation(args) {
    if (!Array.isArray(args) || args.length === 0) return null;
    const cmd = args[0];
    const rest = args.slice(1);

    // Tier A — worktree destructive
    if (cmd === 'checkout') {
        // `git checkout -- <path>` lub `git checkout <branch> -- <path>` lub `git checkout -- .`
        const dashIdx = rest.indexOf('--');
        if (dashIdx !== -1) {
            // ma -- → zawsze worktree destructive (nawet jeśli przed -- jest branch)
            return {
                raw: `git ${args.join(' ')}`,
                tier: 'A',
                kind: 'checkout-path',
                level: 'HIGH',
                args: { dashIdx }
            };
        }
        return null;
    }
    if (cmd === 'restore') {
        // każdy `git restore` to Tier A HIGH (nawet --staged, bo nadpisuje index/worktree)
        return {
            raw: `git ${args.join(' ')}`,
            tier: 'A',
            kind: 'restore',
            level: 'HIGH',
            args: {}
        };
    }
    if (cmd === 'reset' && rest.includes('--hard')) {
        return {
            raw: `git ${args.join(' ')}`,
            tier: 'A',
            kind: 'reset-hard',
            level: 'CRITICAL',
            args: {}
        };
    }
    if (cmd === 'clean') {
        // `git clean -f`, `-fd`, `-fdx`, `-df`, `-xf` etc. — każdy z `f` to destrukcja untracked
        const hasF = rest.some((a) => a.startsWith('-') && a.includes('f'));
        if (hasF) {
            const flags = rest.filter((a) => a.startsWith('-')).join('');
            const hasX = flags.includes('x');
            const hasD = flags.includes('d');
            // -fdx najgroźniejsze, ale wszystkie CRITICAL
            return {
                raw: `git ${args.join(' ')}`,
                tier: 'A',
                kind: 'clean',
                level: 'CRITICAL',
                args: { flags, hasX, hasD }
            };
        }
        return null;
    }

    // Tier B — history (nie blokowany w Etapie 4, ale klasyfikowany)
    if (cmd === 'reset' && !rest.includes('--hard')) {
        return {
            raw: `git ${args.join(' ')}`,
            tier: 'B',
            kind: 'reset',
            level: 'HISTORY-CRITICAL',
            args: {}
        };
    }
    if (cmd === 'rebase')
        return {
            raw: `git ${args.join(' ')}`,
            tier: 'B',
            kind: 'rebase',
            level: 'HISTORY-CRITICAL',
            args: {}
        };
    if (cmd === 'cherry-pick')
        return {
            raw: `git ${args.join(' ')}`,
            tier: 'B',
            kind: 'cherry-pick',
            level: 'HISTORY-CRITICAL',
            args: {}
        };
    if (cmd === 'revert')
        return {
            raw: `git ${args.join(' ')}`,
            tier: 'B',
            kind: 'revert',
            level: 'HISTORY-CRITICAL',
            args: {}
        };
    if (cmd === 'commit' && rest.includes('--amend'))
        return {
            raw: `git ${args.join(' ')}`,
            tier: 'B',
            kind: 'amend',
            level: 'HISTORY-CRITICAL',
            args: {}
        };
    if (cmd === 'push' && (rest.includes('--force') || rest.includes('-f')))
        return {
            raw: `git ${args.join(' ')}`,
            tier: 'B',
            kind: 'push-force',
            level: 'HISTORY-CRITICAL',
            args: {}
        };

    return null;
}

export function requiresSnapshot(op, state) {
    if (!op || !state) return false;
    if (!state.dirty) return false;
    return op.tier === 'A';
}

export function hasForceFlag(args) {
    // jawna autoryzacja: --force lub GIT_SAFETY_FORCE=1 (env) lub --confirm
    if (args.includes('--force') || args.includes('--confirm')) return true;
    if (process.env.GIT_SAFETY_FORCE === '1') return true;
    return false;
}

export function stripForceFlag(args) {
    return args.filter((a) => a !== '--force' && a !== '--confirm');
}
