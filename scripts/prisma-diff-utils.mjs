#!/usr/bin/env node
/*
 * prisma-diff-utils.mjs
 * Wspolne narzedzia do prisma migrate diff.
 *
 * FTS5 (offers_search_fts*): tabele wirtualne tworzone runtime przez
 * src/utils/fts5Sync.ts (ensureFts5Schema) — NIE istnieja w schema.prisma
 * (Prisma nie obsluguje FTS5). Sa oczekiwana roznica na kazdej bazie, ktora
 * przeszla przez auto-heal. GATE #1, GATE #2 i A5 hard guard #3 traktuja je
 * jako znane i nie blokuja na ich podstawie.
 */

export const FTS5_RE = /offers_search_fts\w*/;

/**
 * Czy diff zawiera zmiany poza tabelami FTS5?
 * Output prisma migrate diff (bez --exit-code) ma forme:
 *   [+] Added tables
 *     - offers_search_fts
 *   [-] Removed tables
 *     - offers_search_fts_config
 * Usuwamy linie sekcji naglowkowych i wiersze FTS5; co zostanie = realny dryf.
 */
export function nonFts5Changes(stdout) {
    const text = String(stdout);
    // Brak roznic — Prisma wypisuje dokladnie ten string
    if (/no difference detected/i.test(text)) return [];
    const lines = text.split(/\r?\n/);
    return lines.filter((l) => {
        const t = l.trim();
        if (!t) return false;
        if (FTS5_RE.test(t)) return false;
        if (
            /^\[[-+~!*?]\s*\]?\s*[\w\s]+$/.test(t) &&
            /(table|column|enum|index|type|foreign key|index)/i.test(t)
        )
            return false;
        return true;
    });
}
