function pct(sorted, percentile) {
    if (sorted.length === 0) return 0;
    const index = Math.max(
        0,
        Math.min(sorted.length - 1, Math.ceil((percentile / 100) * sorted.length) - 1)
    );
    return sorted[index];
}

function normalizeEndpoint(url) {
    const match = String(url || '').match(/^([A-Z]+)\s+(\S+)/);
    if (!match) return 'UNKNOWN /unknown';

    const method = match[1];
    const path = match[2].split(/[?#]/, 1)[0];
    const normalizedPath = path
        .split('/')
        .map((segment) => {
            if (/^(?:load100(?:b|x)?|loadbulk)_/i.test(segment)) return ':id';
            if (/^offer_[a-z]+_\d+$/i.test(segment)) return ':id';
            if (/^\d+$/.test(segment) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment))
                return ':id';
            return segment;
        })
        .join('/');

    return `${method} ${normalizedPath}`;
}

function summarize(samples) {
    const times = samples.map((sample) => sample.ms).sort((a, b) => a - b);
    const failures = samples.filter((sample) => sample.status !== 200);
    const statuses = samples.reduce((counts, sample) => {
        counts[sample.status] = (counts[sample.status] || 0) + 1;
        return counts;
    }, {});

    return {
        n: samples.length,
        p50: +pct(times, 50).toFixed(1),
        p95: +pct(times, 95).toFixed(1),
        p99: +pct(times, 99).toFixed(1),
        fail: failures.length,
        throttled: samples.filter((sample) => sample.throttled).length,
        statuses,
        errSample: [...new Set(failures.slice(0, 3).map((sample) => sample.body || ''))].slice(0, 3)
    };
}

function groupAndSummarize(samples, getKey) {
    const groups = new Map();
    for (const sample of samples) {
        const key = getKey(sample);
        const group = groups.get(key) || [];
        group.push(sample);
        groups.set(key, group);
    }
    return Object.fromEntries([...groups].map(([key, values]) => [key, summarize(values)]));
}

function buildLoadReport(samples) {
    const warmupSamples = samples.filter((sample) => sample.phase === 'warmup');
    const steadySamples = samples.filter((sample) => sample.phase === 'steady');

    return {
        ops: groupAndSummarize(steadySamples, (sample) => sample.op),
        warmup: {
            ops: groupAndSummarize(warmupSamples, (sample) => sample.op),
            routes: groupAndSummarize(warmupSamples, (sample) => normalizeEndpoint(sample.url))
        },
        routes: groupAndSummarize(steadySamples, (sample) => normalizeEndpoint(sample.url))
    };
}

module.exports = { buildLoadReport, normalizeEndpoint };
