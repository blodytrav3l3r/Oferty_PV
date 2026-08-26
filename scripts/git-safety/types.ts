// @ts-check
/**
 * Etap 2 — Kontrakt domenowy Git Safety
 * Zero implementacji destrukcyjnej, zero guarda.
 * Źródło prawdy: docs/development/GIT_SAFETY.md §2-4
 */

/**
 * Tier — kategoryzacja operacji wg GIT_SAFETY §2
 */
export type Tier = 'A' | 'B';
export type TierAKind = 'restore' | 'checkout-path' | 'reset-hard' | 'clean';
export type TierBKind = 'reset' | 'rebase' | 'amend' | 'cherry-pick' | 'revert' | 'push-force';
export type OperationKind = TierAKind | TierBKind;

export type Level = 'HIGH' | 'CRITICAL' | 'HISTORY-CRITICAL';

/**
 * Operation — pojedyncza operacja Git poddana ocenie safety
 */
export interface Operation {
    /** surowa komenda, np. "git restore ." */
    raw: string;
    /** tier A (worktree/index) lub B (history) */
    tier: Tier;
    /** kind w ramach tieru */
    kind: OperationKind;
    /** poziom destrukcji wg GIT_SAFETY §11 */
    level: Level;
    /** argumenty po parsowaniu, np. { path: ".", staged: true } */
    args: Record<string, unknown>;
}

/**
 * WorktreeState — stan worktree w chwili detect
 */
export interface WorktreeState {
    branch: string;
    head: string; // commit SHA
    /** pliki staged (index vs HEAD) */
    staged: string[];
    /** pliki unstaged (worktree vs index) */
    unstaged: string[];
    /** pliki untracked (nie w index) */
    untracked: string[];
    /** pliki ignored (tylko dla clean -fdx), poza scope do Etapu 4 */
    ignored: string[];
    /** surowy `git status --short --ignored` */
    statusText: string;
    /** czy dirty = staged|unstaged|untracked >0 */
    dirty: boolean;
}

/**
 * Snapshot — identyfikowalny punkt odzysku (L1)
 * Lokalizacja: .git/safety/snapshots/<ISO>-<shortId>/
 */
export interface Snapshot {
    /** id np. 20260826T194231Z-a81f2c */
    id: string;
    timestamp: string; // ISO8601
    operation: string; // raw z Operation
    branch: string;
    head: string;
    /** skrót stanu przed operacją */
    worktreeState: Pick<
        WorktreeState,
        'staged' | 'unstaged' | 'untracked' | 'ignored' | 'statusText'
    >;
    /** ścieżki artefaktów snapshotu */
    paths: {
        metadataJson: string;
        statusTxt: string;
        diffPatch: string; // git diff HEAD + --staged
        untrackedTar: string; // tar untracked
    };
    /** metadata.json — dodatkowe pola */
    metadata: {
        tier: Tier;
        kind: OperationKind;
        level: Level;
        expectedFiles: number; // staged+unstaged+untracked
    };
}

/**
 * VerificationResult — czy snapshot pokrywa stan przed destrukcją
 */
export interface VerificationResult {
    ok: boolean;
    expectedFiles: number;
    snapshotFiles: number;
    /** powód niepowodzenia, np. "snapshot missing untrackedTar" */
    reason?: string;
    /** id snapshotu którego dotyczy */
    snapshotId: string;
}

/**
 * Authorization — jawne potwierdzenie przed destrukcją
 */
export interface Authorization {
    confirmed: boolean;
    snapshotId: string;
    operation: string;
    /** HIGH → y/N, CRITICAL/HISTORY-CRITICAL → --confirm flag dla agenta */
    level: Level;
}

/**
 * RecoveryResult — wynik odzysku L1
 */
export interface RecoveryResult {
    ok: boolean;
    snapshotId: string;
    restoredFiles: number;
    /** błąd odzysku */
    reason?: string;
}

/**
 * SafetyGateDecision — decyzja gate po detect
 */
export type SafetyGateDecision =
    | { proceed: true; operation: Operation; worktreeState: WorktreeState }
    | {
          proceed: false;
          operation: Operation;
          worktreeState: WorktreeState;
          snapshot: Snapshot;
          verification: VerificationResult;
      };

// Guard helper — czy destrukcja wymaga snapshotu
export function requiresSnapshot(op: Operation, state: WorktreeState): boolean {
    if (!state.dirty) return false;
    // Tier A zawsze wymaga snapshotu na dirty; Tier B — tylko jeśli destrukcja history + dirty (Etap 4)
    return op.tier === 'A';
}
