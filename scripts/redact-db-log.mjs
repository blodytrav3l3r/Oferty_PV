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
for (const rawUrl of [process.env.DATABASE_URL, process.env.MIGRATION_DATABASE_URL]) {
    if (!rawUrl) continue;
    secrets.add(rawUrl);
    try {
        const databaseUrl = new URL(rawUrl);
        for (const secret of [databaseUrl.username, databaseUrl.password]) {
            if (!secret) continue;
            secrets.add(secret);
            secrets.add(decodeURIComponent(secret));
        }
    } catch {
        // The entrypoint validates database URLs before invoking database commands.
    }
}

for (const secret of [...secrets].sort((left, right) => right.length - left.length)) {
    output = output.replaceAll(secret, '[REDACTED]');
}

output = output.replace(/(postgres(?:ql)?:\/\/)[^\s"'@]+@/gi, '$1[REDACTED]@');
process.stdout.write(output);
