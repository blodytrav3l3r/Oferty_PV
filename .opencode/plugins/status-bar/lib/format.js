// Formatery Status Bara — czyste funkcje, zero zależności.
// Zwracają null gdy danych brak — widok decyduje o ukryciu lub "N/A"
// (ETAP 21: nigdy nie pokazujemy zmyślonych wartości).

const NA = 'N/A';

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/** 8421 -> "8.4k", 200000 -> "200k", 1240000 -> "1.24M" */
export function formatCompact(n) {
  if (!isNum(n)) return null;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const m = n / 1_000_000;
    return `${trimZero(m.toFixed(2))}M`;
  }
  if (abs >= 1000) {
    const k = n / 1000;
    return `${trimZero(k.toFixed(1))}k`;
  }
  return String(Math.round(n));
}

function trimZero(s) {
  return s.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

/** 6317 -> "6,317" */
export function formatInt(n) {
  if (!isNum(n)) return null;
  return Math.round(n).toLocaleString('en-US');
}

/** 0.0421 -> "4.2%", 0.42 -> "42%" */
export function formatPercent(ratio) {
  if (!isNum(ratio)) return null;
  const pct = ratio * 100;
  if (pct >= 10) return `${Math.round(pct)}%`;
  return `${trimZero(pct.toFixed(1))}%`;
}

/** Czas sesji: 1458000 -> "00:24:18", ponad godzinę -> "1:02:03" */
export function formatSessionDuration(ms) {
  if (!isNum(ms) || ms < 0) return null;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `00:${mm}:${ss}`;
}

/** Czas requestu: 12830 -> "12.83s", dłużej niż minuta -> "1:23.5s" */
export function formatRequestDuration(ms) {
  if (!isNum(ms) || ms < 0) return null;
  if (ms < 60_000) {
    const sec = ms / 1000;
    const decimals = sec >= 100 ? 1 : 2;
    return `${sec.toFixed(decimals)}s`;
  }
  const total = ms / 1000;
  const m = Math.floor(total / 60);
  const rest = total - m * 60;
  return `${m}:${rest.toFixed(1).padStart(4, '0')}s`;
}

/**
 * Throughput: outputTokens / generationTimeMs.
 * Zero tokenów, zero czasu lub brak danych -> null (nie "0.0" — fałsz).
 * Bardzo szybka generacja -> kompaktowo ("12.3k tok/s").
 */
export function computeTokPerSec(outputTokens, generationMs) {
  if (!isNum(outputTokens) || !isNum(generationMs)) return null;
  if (outputTokens <= 0 || generationMs <= 0) return null;
  return (outputTokens / generationMs) * 1000;
}

/** 39.414 -> "39.4 tok/s"; >=1000 -> "12.3k tok/s" */
export function formatTokPerSec(tps) {
  if (!isNum(tps) || tps <= 0) return null;
  if (tps >= 1000) return `${trimZero((tps / 1000).toFixed(1))}k tok/s`;
  return `${tps.toFixed(1)} tok/s`;
}

/** Koszt z API providera: 0.084 -> "$0.084", 1.42 -> "$1.42" */
export function formatCost(cost) {
  if (!isNum(cost) || cost < 0) return null;
  if (cost === 0) return '$0.00';
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

/** Poziom wykorzystania kontekstu wg progów 80%/90%. */
export function contextLevel(ratio) {
  if (!isNum(ratio)) return 'ok';
  if (ratio >= 0.9) return 'danger';
  if (ratio >= 0.8) return 'warn';
  return 'ok';
}

/**
 * Mapowanie stanu sesji OpenCode na glyph + etykietę paska.
 * retry = backoff providera (rate limit / błąd przejściowy).
 */
export function formatStatus(statusType) {
  switch (statusType) {
    case 'busy':
      return { glyph: '◉', label: 'GENERATING' };
    case 'retry':
      return { glyph: '⚠', label: 'RATE LIMITED' };
    case 'error':
      return { glyph: '✕', label: 'ERROR' };
    case 'disconnected':
      return { glyph: '○', label: 'DISCONNECTED' };
    case 'idle':
      return { glyph: '●', label: 'IDLE' };
    default:
      // Brak danych o stanie — nie zgadujemy (ETAP 3).
      return { glyph: '●', label: 'READY' };
  }
}

/** Skrócenie długiego ID modelu środkiem: "anthropic/claud…sonnet-4-5" */
export function truncateMiddle(str, max) {
  if (typeof str !== 'string' || str.length <= max) return str;
  if (max < 5) return str.slice(0, max);
  const keep = Math.floor((max - 1) / 2);
  return `${str.slice(0, keep)}…${str.slice(-keep)}`;
}

/**
 * Priorytety sekcji wg szerokości terminala (ETAP 14).
 * Od prawej ucinamy najmniej istotne: cost -> last -> ttft -> provider.
 */
export function pickSections(width) {
  const w = isNum(width) && width > 0 ? width : 100;
  if (w >= 150) return ['model', 'provider', 'status', 'tps', 'ttft', 'context', 'last', 'session', 'cost'];
  if (w >= 105) return ['model', 'provider', 'status', 'tps', 'context', 'session'];
  if (w >= 75) return ['model', 'status', 'tps', 'context', 'session'];
  return ['model', 'tps', 'session'];
}

export { NA };
