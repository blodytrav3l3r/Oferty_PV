export interface MojibakeMatch {
    seq: string;
    fixed: string;
}

export function detectMojibake(text: string): MojibakeMatch[];
export function fixMojibake(text: string): string;
export function classifyMojibake(
    mojibakeCount: number,
    hasPolishContext: boolean,
    isConventionFile: boolean
): 'OK' | 'ERROR' | 'WARN';
export function isPolishConventionFile(filePath: string): boolean;
