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
                    if (!line.trim().startsWith('//') && !line.includes('PRAGMA')) {
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
