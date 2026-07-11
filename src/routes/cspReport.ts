import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRateLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';

const router = express.Router();
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'csp-violations.log');
const VERSION_FILE = path.join(process.cwd(), 'VERSION');
const NODE_ENV = process.env.NODE_ENV || 'development';

const CLEANUP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dni

let _release = '';
let _buildId = '';

function readMetadata() {
    try {
        _release = fs.readFileSync(VERSION_FILE, 'utf8').trim();
        const hash = crypto
            .createHash('sha256')
            .update(_release + new Date().toISOString().slice(0, 10))
            .digest('hex')
            .slice(0, 7);
        _buildId = `${_release.replace(/\./g, '')}.${hash}`;
    } catch {
        _release = '0.0.0';
        _buildId = 'unknown';
    }
}
readMetadata();

function cleanupOldEntries(): void {
    try {
        if (!fs.existsSync(LOG_FILE)) return;
        const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean);
        const cutoff = Date.now() - CLEANUP_MAX_AGE_MS;
        const kept = lines.filter((line) => {
            try {
                const entry = JSON.parse(line);
                return new Date(entry.timestamp).getTime() > cutoff;
            } catch {
                return false;
            }
        });
        if (kept.length < lines.length) {
            fs.writeFileSync(LOG_FILE, kept.join('\n') + (kept.length > 0 ? '\n' : ''), 'utf8');
            logger.info('CSP', `Wyczyszczono ${lines.length - kept.length} starych wpisów CSP`);
        }
    } catch {
        /* ignore cleanup errors */
    }
}
cleanupOldEntries();

const cspLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxHits: 100,
    message: 'Too many CSP reports'
});

function makeFingerprint(
    violatedDirective: string,
    blockedURI: string,
    sourceFile: string,
    lineNumber: string
): string {
    const raw = `${violatedDirective}:${blockedURI}:${sourceFile}:${lineNumber}`;
    return crypto.createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 12);
}

function sanitize(obj: unknown): unknown {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(sanitize);
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            sanitized[key] = value.slice(0, 500);
        } else if (typeof value === 'object') {
            sanitized[key] = sanitize(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

router.post(
    '/',
    cspLimiter,
    express.json({
        limit: '10kb',
        type: ['application/csp-report', 'application/json']
    }),
    (req, res) => {
        try {
            const report = req.body?.['csp-report'] || req.body;

            const violatedDirective = report['violated-directive'] || '';
            const blockedURI = report['blocked-uri'] || '';
            const sourceFile = report['source-file'] || '';
            const lineNumber = report['line-number'] || '';

            const entry = {
                timestamp: new Date().toISOString(),
                environment: NODE_ENV,
                release: _release,
                buildId: _buildId,
                route: req.path || '',
                document: report['document-uri'] || '',
                blockedURI,
                violatedDirective,
                effectiveDirective: report['effective-directive'] || '',
                originalPolicy: report['original-policy'] || '',
                sourceFile,
                lineNumber,
                columnNumber: report['column-number'] || '',
                userAgent: (req.headers['user-agent'] || '').slice(0, 200),
                fingerprint: makeFingerprint(violatedDirective, blockedURI, sourceFile, lineNumber)
            };

            const safeEntry = sanitize(entry);
            if (!fs.existsSync(LOG_DIR)) {
                fs.mkdirSync(LOG_DIR, { recursive: true });
            }
            fs.appendFileSync(LOG_FILE, JSON.stringify(safeEntry) + '\n', 'utf8');
            res.status(204).end();
        } catch (err) {
            logger.error(
                'CSP',
                'Blad zapisu raportu CSP:',
                err instanceof Error ? err.message : String(err)
            );
            res.status(204).end();
        }
    }
);

export default router;
