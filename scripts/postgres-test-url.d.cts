export function parsePostgresTestUrl(rawUrl: string | undefined): URL;
export function readPostgresTestUrl(): string | undefined;
export function getPostgresTestConfig(
    envPath?: string,
    environment?: NodeJS.ProcessEnv
): { port: number; url: URL };
export function withPostgresTestPort(rawUrl: string | undefined, port: number): string;
export function findAvailablePostgresTestPort(
    preferredPort: number,
    scanSize?: number
): Promise<number>;
export function updatePostgresTestConfigPort(
    port: number,
    options?: { envPath?: string; environment?: NodeJS.ProcessEnv }
): { changed: boolean; url: string };
export function preparePostgresTestPort(
    envPath?: string,
    environment?: NodeJS.ProcessEnv
): Promise<{ port: number; url: string; changed: boolean }>;
