// Układ compact bara — czysta funkcja state+theme+width -> komórki tekstowe.
// Testowalna w node bez JSX (ETAP 19 responsive).

import {
  pickSections,
  formatStatus,
  formatCompact,
  formatInt,
  formatPercent,
  formatTokPerSec,
  formatCost,
  formatSessionDuration,
  formatRequestDuration,
  truncateMiddle,
  contextLevel,
} from './format.js';
import { contextUsage, liveTokPerSec } from './state.js';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SEP = { text: '│ ', separator: true };

/**
 * Zwraca tablicę komórek { text, fg?, separator? } wg priorytetów szerokości.
 * Brakująca metryka = brak komórki (nigdy puste placeholder-y).
 */
export function renderCompact(state, theme, width) {
  const cells = {};
  const t = theme ?? {};

  const modelName = state.model.name ?? state.model.id ?? 'Unknown';
  const modelMax = Math.min(42, Math.max(12, Math.floor((width ?? 100) / 4)));
  cells.model = { text: truncateMiddle(modelName, modelMax), fg: t.text };

  const providerName = state.provider.name ?? state.provider.id;
  if (providerName) cells.provider = { text: truncateMiddle(providerName, 20), fg: t.text };

  const st = formatStatus(state.statusType);
  const retrySuffix =
    state.statusType === 'retry' && state.retry?.attempt != null ? ` #${state.retry.attempt}` : '';
  cells.status = {
    text: `${st.glyph} ${st.label}${retrySuffix}`,
    fg: statusColor(state.statusType, t),
  };

  const tps = liveTokPerSec(state) ?? state.last.tokPerSec;
  if (tps != null) {
    cells.tps = { text: formatTokPerSec(tps), fg: t.info };
  } else if (state.live.active) {
    const frame = SPINNER_FRAMES[Math.floor(state.nowMs / 120) % SPINNER_FRAMES.length];
    cells.tps = { text: frame, fg: t.primary };
  }

  if (state.last.ttftMs != null) {
    cells.ttft = { text: `TTFT ${(state.last.ttftMs / 1000).toFixed(2)}s`, fg: t.textMuted };
  }

  const { used, ratio } = contextUsage(state);
  if (used != null) {
    const level = contextLevel(ratio);
    // Markery !/!! — informacja nie tylko kolorem (ETAP 18)
    const mark = level === 'danger' ? '!!' : level === 'warn' ? '!' : '';
    const limitPart = state.contextLimit ? `/${formatCompact(state.contextLimit)}` : '';
    const pctPart = ratio != null ? ` (${formatPercent(ratio)})` : '';
    cells.context = {
      text: `${formatCompact(used)}${limitPart}${pctPart}${mark}`,
      fg:
        level === 'danger'
          ? t.error
          : level === 'warn'
            ? t.warning
            : t.textMuted,
    };
  }

  if (state.live.active) {
    const start = state.live.firstDeltaAtMs ?? state.live.startedAtMs;
    if (start != null) {
      cells.last = {
        text: formatRequestDuration(Math.max(0, state.nowMs - start)),
        fg: t.textMuted,
      };
    }
  } else if (state.last.requestMs != null) {
    cells.last = { text: `Last ${formatRequestDuration(state.last.requestMs)}`, fg: t.textMuted };
  }

  cells.session = {
    text: formatSessionDuration(Math.max(0, state.nowMs - state.session.startedAtMs)) ?? '00:00',
    fg: t.textMuted,
  };

  if (state.session.hasCostData) {
    const cost = formatCost(state.session.cost);
    if (cost) cells.cost = { text: cost, fg: t.success };
  }

  const out = [];
  for (const key of pickSections(width)) {
    const cell = cells[key];
    if (!cell) continue;
    if (out.length > 0) out.push(SEP);
    out.push(cell);
  }
  return out;
}

function statusColor(statusType, t) {
  switch (statusType) {
    case 'busy':
      return t.primary;
    case 'retry':
      return t.warning;
    case 'error':
    case 'disconnected':
      return t.error;
    case 'idle':
      return t.success;
    default:
      return t.textMuted;
  }
}

/**
 * Wiersze [etykieta, wartość] dla trybu detailed (ETAP 13).
 * Tylko realne dane; kluczowe braki jawnie jako N/A.
 */
export function renderDetailRows(state) {
  const rows = [];
  const push = (label, value) => {
    if (value != null && value !== '') rows.push([label, value]);
  };

  push('Model', state.model.name ?? state.model.id ?? 'Unknown');
  push('Provider', state.provider.name ?? state.provider.id);
  const st = formatStatus(state.statusType);
  rows.push(['Status', st.label]);
  if (state.retry?.message) {
    push('Retry', `#${state.retry.attempt ?? '?'} ${state.retry.message}`);
  }

  const avgTps = state.history.tpsCount > 0 ? state.history.tpsSum / state.history.tpsCount : null;
  if (state.last.tokPerSec != null || avgTps != null) {
    push('Current', formatTokPerSec(state.last.tokPerSec));
    push('Average', formatTokPerSec(avgTps));
    push('Peak', formatTokPerSec(state.history.tpsPeak));
  }
  if (state.last.ttftMs != null) push('TTFT', `${(state.last.ttftMs / 1000).toFixed(2)}s`);
  push(
    'Generation',
    state.live.active
      ? 'in progress'
      : state.last.generationMs != null
        ? formatRequestDuration(state.last.generationMs)
        : null,
  );
  push(
    'Request',
    state.live.active ? 'in progress' : state.last.requestMs != null ? formatRequestDuration(state.last.requestMs) : null,
  );

  if (state.session.hasTokenData) {
    push('Input', formatInt(state.session.inputTokens));
    push('Output', formatInt(state.session.outputTokens));
  } else {
    rows.push(['Tokens', 'N/A']);
  }

  const { used, ratio } = contextUsage(state);
  if (used != null) {
    const text =
      `${formatInt(used)}${state.contextLimit ? ` / ${formatInt(state.contextLimit)}` : ''}` +
      (ratio != null ? ` (${formatPercent(ratio)})` : '');
    rows.push(['Context', text]);
  } else {
    rows.push(['Context', 'N/A']);
  }

  rows.push([
    'Session duration',
    formatSessionDuration(Math.max(0, state.nowMs - state.session.startedAtMs)) ?? 'N/A',
  ]);
  push('Requests', String(state.session.requests));
  push('Messages', String(state.session.messages));

  rows.push(['Cost', state.session.hasCostData ? formatCost(state.session.cost) : 'N/A']);
  return rows;
}
