import fs from 'fs';
import { PRINT_TOKENS_CSS } from './printTokens';

const cache = new Map<string, string>();

/**
 * P2: szablony PDF w pamięci (1 odczyt na proces zamiast 1 na request).
 * Szablony zmieniają się tylko przy deployu — restart procesu odświeża.
 * // ponytail: brak invalidacji mtime, statSync na request mijałby się z celem.
 */
export function loadPdfTemplate(templatePath: string): string {
    const hit = cache.get(templatePath);
    if (hit !== undefined) return hit;
    let template: string;
    try {
        template = fs
            .readFileSync(templatePath, 'utf-8')
            .replace(/\{\{PRINT_TOKENS\}\}/g, PRINT_TOKENS_CSS);
    } catch (e) {
        throw new Error(
            'Nie mozna wczytac szablonu PDF (' +
                templatePath +
                '): ' +
                (e instanceof Error ? e.message : String(e))
        );
    }
    cache.set(templatePath, template);
    return template;
}

/** Tylko do testów — czyści cache między przypadkami. */
export function clearPdfTemplateCache(): void {
    cache.clear();
}
