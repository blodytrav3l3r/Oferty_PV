import * as fs from 'fs';
import * as path from 'path';

export function readCssFile(relativePath: string): string {
    return fs.readFileSync(path.resolve(__dirname, '../..', relativePath), 'utf-8');
}

export function readHtmlFile(relativePath: string): string {
    return fs.readFileSync(path.resolve(__dirname, '../..', relativePath), 'utf-8');
}

export function hasMediaQuery(
    css: string,
    breakpoint: string,
    selector: string,
    property: string,
    value: string
): boolean {
    const mqRegex = new RegExp(
        `@media\\s*\\(max-width:\\s*${breakpoint}\\)[\\s\\S]*?\\}[\\s]*\\}`,
        'g'
    );
    const matches = css.match(mqRegex);
    if (!matches) return false;

    for (const mq of matches) {
        if (mq.includes(selector) && mq.includes(`${property}: ${value}`)) {
            return true;
        }
    }
    return false;
}
