export interface ParsedProductionNumber {
    year: number;
    seqNumber: number;
}

const MAX_SEQUENCE_NUMBER = 2_147_483_647;

export function formatProductionNumber(
    yearLetter: string,
    seqNumber: number,
    year: number
): string {
    return `${yearLetter}/${String(seqNumber).padStart(5, '0')}/${String(year).slice(-2)}`;
}

export function isCurrentProductionNumber(value: string): boolean {
    const parts = value.split('/');
    return (
        parts.length === 3 &&
        Array.from(parts[0]).length === 1 &&
        /^(?:\d{5}|[1-9]\d{5,})$/.test(parts[1]) &&
        Number(parts[1]) <= MAX_SEQUENCE_NUMBER &&
        /^\d{2}$/.test(parts[2])
    );
}

export function parseProductionNumber(value: string): ParsedProductionNumber | null {
    const parts = value.split('/');
    const isCurrentFormat = isCurrentProductionNumber(value);
    const isLegacyFormat =
        parts.length === 4 &&
        parts[0].length > 0 &&
        (parts[1] === 'PZ' || Array.from(parts[1]).length === 1);
    if (!isCurrentFormat && !isLegacyFormat) return null;

    const seqIndex = isCurrentFormat ? 1 : 2;
    const yearIndex = isCurrentFormat ? 2 : 3;
    const validSequence = isCurrentFormat
        ? /^(?:\d{5}|[1-9]\d{5,})$/.test(parts[seqIndex])
        : /^\d+$/.test(parts[seqIndex]);
    if (!validSequence || !/^\d{2}$/.test(parts[yearIndex])) return null;

    const seqNumber = Number(parts[seqIndex]);
    if (!Number.isSafeInteger(seqNumber) || seqNumber < 1 || seqNumber > MAX_SEQUENCE_NUMBER)
        return null;

    return { year: 2000 + Number(parts[yearIndex]), seqNumber };
}
