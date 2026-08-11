import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';
import { resolvePublicDir } from '../../utils/paths';

/**
 * Ładuje letterhead (nagłówek/stopkę firmową) jako data URI base64.
 * Współdzielone przez generatory PDF (rury, studnie, wydruk łączny).
 */
export function loadLetterheadBase64(): { header: string; footer: string } {
    const load = (filename: string): string => {
        try {
            const buf = fs.readFileSync(path.join(resolvePublicDir(), 'images', filename));
            return `data:image/png;base64,${buf.toString('base64')}`;
        } catch (e) {
            logger.warn('PdfAssets', `Brak pliku ${filename}`, e);
            return '';
        }
    };
    return { header: load('letterhead-header.png'), footer: load('letterhead-footer.png') };
}
