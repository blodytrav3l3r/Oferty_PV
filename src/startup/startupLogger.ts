import { logger } from '../utils/logger';

const TAG = 'Startup';

export const startupLogger = {
    section(title: string): void {
        logger.info(TAG, '');
        logger.info(TAG, '========================================');
        logger.info(TAG, `  ${title}`);
        logger.info(TAG, '========================================');
    },

    step(label: string, description: string): void {
        logger.info(TAG, '');
        logger.info(TAG, `--- ${label}: ${description} ---`);
    },

    success(message: string): void {
        logger.info(TAG, `  ✓ ${message}`);
    },

    warn(message: string): void {
        logger.warn(TAG, `  ⚠ ${message}`);
    },

    fail(message: string): void {
        logger.error(TAG, `  ✗ ${message}`);
    },

    value(label: string, value: string | number | boolean): void {
        logger.info(TAG, `    ├─ ${label}: ${value}`);
    },

    valueLast(label: string, value: string | number | boolean): void {
        logger.info(TAG, `    └─ ${label}: ${value}`);
    },

    info(message: string): void {
        logger.info(TAG, `  ${message}`);
    },

    error(message: string, error?: unknown): void {
        logger.error(TAG, message, error);
    }
};
