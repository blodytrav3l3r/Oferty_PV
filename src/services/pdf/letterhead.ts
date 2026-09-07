import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';
import { resolvePublicDir } from '../../utils/paths';

/**
 * Ładuje letterhead (nagłówek/stopkę firmową) jako data URI base64.
 * Współdzielone przez generatory PDF (rury, studnie, wydruk łączny).
 * P2: cache w pamięci — PNG + base64 raz na proces zamiast na każdy request.
 */
const letterheadCache = new Map<string, string>();

function loadImage(filename: string): string {
    const hit = letterheadCache.get(filename);
    if (hit !== undefined) return hit;
    let out = '';
    try {
        const buf = fs.readFileSync(path.join(resolvePublicDir(), 'images', filename));
        out = `data:image/png;base64,${buf.toString('base64')}`;
    } catch (e) {
        logger.warn('PdfAssets', `Brak pliku ${filename}`, e);
    }
    letterheadCache.set(filename, out);
    return out;
}

export function loadLetterheadBase64(): { header: string; footer: string } {
    return {
        header: loadImage('letterhead-header.png'),
        footer: loadImage('letterhead-footer.png')
    };
}

/** Tylko do testów. */
export function clearLetterheadCache(): void {
    letterheadCache.clear();
}
