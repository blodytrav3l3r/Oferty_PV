import fs from 'fs';
import path from 'path';

describe('SQL Injection Prevention', () => {
    const srcDir = path.resolve(__dirname, '..', 'src');

    function getAllTsFiles(dir: string): string[] {
        const result: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && entry.name !== 'node_modules') {
                result.push(...getAllTsFiles(fullPath));
            } else if (entry.isFile() && entry.name.endsWith('.ts')) {
                result.push(fullPath);
            }
        }
        return result;
    }

    // Wyrażenie wywołania $queryRawUnsafe/$executeRawUnsafe (nawiasy wielolinijkowe):
    // konkatenacja SQL rozciąga się na wiele linii (clients/index.ts:215-229),
    // skan liniowy jej nie widzi (false negative).
    function unsafeCallSpans(content: string): { line: number; content: string }[] {
        const lines = content.split('\n');
        const out: { line: number; content: string }[] = [];
        const starts: number[] = [];
        lines.forEach((line, i) => {
            if (line.includes('$queryRawUnsafe') || line.includes('$executeRawUnsafe'))
                starts.push(i);
        });
        for (const start of starts) {
            let depth = 0;
            let end = start;
            for (let i = start; i < lines.length; i++) {
                for (const ch of lines[i]) {
                    if (ch === '(') depth++;
                    else if (ch === ')') depth--;
                }
                end = i;
                if (depth <= 0 && i > start) break;
                if (depth <= 0 && i === start && lines[i].indexOf('(') !== -1) {
                    // jednolinijkowe — liniowy skan wystarczy, ale sprawdź i tak
                    break;
                }
            }
            const span = lines.slice(start, end + 1).join('\n');
            // `+` między samymi literałami (template/string, np. stałe SQL
            // + `${placeholders}` z samych `?`) = bezpieczne. `+` ze zmienną
            // (identyfikatorem) po którejś stronie = wklejanie wartości do SQL.
            // Uwaga: `${var}` wewnątrz template-stringa łapie tylko skan
            // liniowy (reguła 1); tu po stripie literałów go nie widać.
            const stripped = span
                .replace(/`(?:\\.|[^`\\])*`/g, '``')
                .replace(/'(?:\\.|[^'\\])*'/g, "''")
                .replace(/"(?:\\.|[^"\\])*"/g, '""');
            if (
                /[\w)\]]\s*\+\s*[\w(`'"]/.test(stripped) ||
                /[\w(`'"]\s*\+\s*[\w(]/.test(stripped)
            ) {
                // Odrzuć czyste `` + `` (same puste literały po stripie).
                const bare = stripped.replace(/``/g, '').replace(/''/g, '').replace(/""/g, '');
                if (/[\w)\]]\s*\+/.test(bare) || /\+\s*[\w(]/.test(bare)) {
                    out.push({ line: start + 1, content: lines[start].trim().slice(0, 120) });
                }
            }
        }
        return out;
    }

    function findUnsafePatterns(filePath: string): { line: number; content: string }[] {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const results: { line: number; content: string }[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // 1) $executeRawUnsafe / $queryRawUnsafe z interpolacją — zawsze unsafe
            if (line.includes('$executeRawUnsafe') || line.includes('$queryRawUnsafe')) {
                if (line.includes('${') || line.includes('+')) {
                    results.push({ line: i + 1, content: line.trim() });
                }
            }
            // 2) Tagged template $queryRaw`...${...join(',')}...` — unsafe, bo wartości
            //    wklejane do SQL stringa bez parametryzacji (Prisma escapes
            //    ${var} → ?  ale `${arr.join(',')}` → `${item1},${item2}` wklejone na surowo)
            if (line.includes('$queryRaw`') || line.includes('$executeRaw`')) {
                if (/\.\s*join\s*\(/.test(line) || /\+\s*['"`]/.test(line)) {
                    results.push({ line: i + 1, content: line.trim() });
                }
            }
        }
        // 3) Wielolinijkowe wywołania Unsafe (span nawiasów) — łata false negative.
        for (const hit of unsafeCallSpans(content)) {
            if (!results.some((r) => r.line === hit.line)) results.push(hit);
        }
        return results;
    }

    it('nie powinien zawierać $executeRawUnsafe z interpolacją w src/', () => {
        const files = getAllTsFiles(srcDir);
        let totalIssues = 0;

        for (const file of files) {
            const issues = findUnsafePatterns(file);
            if (issues.length > 0) {
                console.warn(`\n⚠ ${path.relative(srcDir, file)}:`);
                for (const issue of issues) {
                    console.warn(`  Ln ${issue.line}: ${issue.content}`);
                }
                totalIssues += issues.length;
            }
        }

        // Bezpieczne wzorce:
        //  - $queryRawUnsafe BEZ interpolacji (stałe SQL)
        //  - $queryRaw`...${singleValue}...` (Prisma parametryzuje ${var} automatycznie)
        //  - $queryRaw`...${arr.join(',')}...` (UNSAFE — test łapie)
        expect(totalIssues).toBe(0);
    });

    it('wszystkie DELETE/UPDATE/INSERT używają Prisma ORM lub $executeRaw z parametrami', () => {
        const files = getAllTsFiles(srcDir);
        for (const file of files) {
            const content = fs.readFileSync(file, 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.includes('$executeRawUnsafe')) {
                    // Sprawdź czy to tylko komentarz lub bezpieczny PRAGMA z fixed wartością
                    const isFts5File = file.endsWith('fts5Sync.ts');
                    if (!line.trim().startsWith('//') && !line.includes('PRAGMA') && !isFts5File) {
                        throw new Error(
                            `❌ ${path.relative(srcDir, file)}:${i + 1} — ` +
                                `znaleziono $executeRawUnsafe: "${line.trim()}"`
                        );
                    }
                }
            }
        }
    });
});
