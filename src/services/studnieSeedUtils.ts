import fs from 'fs';
import path from 'path';

const SEED_DIR = 'data/seed/studnie';

const FILE_MAP: Record<string, string[]> = {
    '01-konstrukcja.json': ['dennica', 'krag', 'krag_ot', 'styczna'],
    '02-skladowe.json': [
        'konus',
        'plyta_din',
        'plyta_redukcyjna',
        'plyta_zamykajaca',
        'pierscien_odciazajacy'
    ],
    '03-przejscia.json': ['przejscie'],
    '04-akcesoria.json': ['uszczelka', 'kineta', 'avr', 'wlaz']
};

/** Zwraca wszystkie produkty seed studni (merge 4 plików) */
export function readStudnieSeedProducts(): Record<string, unknown>[] {
    const dir = path.resolve(SEED_DIR);
    const products: Record<string, unknown>[] = [];
    for (const fileName of Object.keys(FILE_MAP)) {
        const filePath = path.join(dir, fileName);
        if (!fs.existsSync(filePath)) continue;
        const raw = fs.readFileSync(filePath, 'utf-8');
        try {
            const items = JSON.parse(raw);
            if (Array.isArray(items)) products.push(...items);
        } catch {
            continue;
        }
    }
    return products;
}

/** Zapisuje produkty seed studni z powrotem do 4 plików (grupuje po componentType) */
export function writeStudnieSeedProducts(products: Record<string, unknown>[]): void {
    const dir = path.resolve(SEED_DIR);
    fs.mkdirSync(dir, { recursive: true });

    const compToFile: Record<string, string> = {};
    for (const [fileName, types] of Object.entries(FILE_MAP)) {
        for (const t of types) compToFile[t] = fileName;
    }

    const grouped: Record<string, Record<string, unknown>[]> = {};
    for (const p of products) {
        const ct = String((p as Record<string, unknown>).componentType ?? '');
        const fn = compToFile[ct] || Object.keys(FILE_MAP)[0];
        if (!grouped[fn]) grouped[fn] = [];
        grouped[fn].push(p);
    }

    for (const [fileName, items] of Object.entries(grouped)) {
        const filePath = path.join(dir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf-8');
    }
}

/** Zwraca listę nazw plików seed w odpowiedniej kolejności */
export function getStudnieSeedFilenames(): string[] {
    return Object.keys(FILE_MAP);
}

/** Zwraca mapowanie: nazwa pliku → lista componentType */
export function getStudnieSeedFileMap(): Record<string, string[]> {
    return { ...FILE_MAP };
}

/** Zwraca absolutną ścieżkę do katalogu seed */
export function getStudnieSeedDir(): string {
    return path.resolve(SEED_DIR);
}
