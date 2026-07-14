/**
 * Strukturalny Logger
 *
 * Zastępuje bezpośrednie wywołania console.log/error/warn
 * ujednoliconym formatem z timestampem i poziomem logowania.
 * W przyszłości łatwo wymienić na winston/pino bez zmian w kodzie.
 */

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

function formatMessage(level: LogLevel, tag: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${tag}] ${message}`;
}

export const logger = {
    info(tag: string, message: string, data?: unknown): void {
        const formatted = formatMessage('INFO', tag, message);
        if (data !== undefined) {
            console.log(formatted, data);
        } else {
            console.log(formatted);
        }
    },

    warn(tag: string, message: string, data?: unknown): void {
        const formatted = formatMessage('WARN', tag, message);
        if (data !== undefined) {
            console.warn(formatted, data);
        } else {
            console.warn(formatted);
        }
    },

    error(tag: string, message: string, error?: unknown): void {
        const formatted = formatMessage('ERROR', tag, message);
        if (error !== undefined) {
            console.error(formatted, error);
        } else {
            console.error(formatted);
        }
    },

    debug(tag: string, message: string, data?: unknown): void {
        if (process.env.NODE_ENV === 'production') return;
        const formatted = formatMessage('DEBUG', tag, message);
        if (data !== undefined) {
            console.log(formatted, data);
        } else {
            console.log(formatted);
        }
    }
};
