import fs from 'node:fs';

const logPath = process.argv[2];
if (!logPath) {
    process.stderr.write('Database command log path is required.\n');
    process.exit(2);
}

let output;
try {
    output = fs.readFileSync(logPath, 'utf8');
} catch {
    process.stderr.write('Unable to read database command output.\n');
    process.exit(2);
}

const secrets = new Set();
const rawUrl = process.env.DATABASE_URL;
if (rawUrl) {
    secrets.add(rawUrl);
    try {
        const databaseUrl = new URL(rawUrl);
        for (const secret of [databaseUrl.username, databaseUrl.password]) {
            if (!secret) continue;
            secrets.add(secret);
            secrets.add(decodeURIComponent(secret));
        }
    } catch {
        // The entrypoint validates DATABASE_URL before invoking database commands.
    }
}

for (const secret of [...secrets].sort((left, right) => right.length - left.length)) {
    output = output.replaceAll(secret, '[REDACTED]');
}

output = output.replace(/(postgres(?:ql)?:\/\/)[^\s"'@]+@/gi, '$1[REDACTED]@');
process.stdout.write(output);
