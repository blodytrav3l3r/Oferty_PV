// Store Status Bara — zwykły JS + subskrypcje (bez zależności od solid-js,
// żeby logika była w 100% testowalna przez node --test).
//
// Zasada danych: WSZYSTKO pochodzi z eventów/OpenCode. Pole, którego
// provider nie dostarczyło, zostaje null -> widok pokazuje N/A albo ukrywa.

function initial() {
  return {    model: { id: null, name: null }, // nazwa z katalogu; fallback = id
    provider: { id: null, name: null },
    contextLimit: null, // model.limit.context z katalogu models.dev
    statusType: null, // idle | busy | retry | error | disconnected
    retry: null, // { attempt, message } dla stanu retry

    // Ostatni request (assistant message)
    last: {
      messageID: null,
      input: null,
      output: null,
      reasoning: null,
      cacheRead: null,
      cacheWrite: null,
      total: null,
      cost: null,
      ttftMs: null, // pierwszy delta - start wiadomości (pomiar klienta)
      requestMs: null, // completed - created (czas całego requestu)
      generationMs: null, // completed - first delta (czas generowania)
      tokPerSec: null,
    },
    live: {
      active: false, // trwa generowanie
      startedAtMs: null, // timestamp startu aktualnego requestu
      firstDeltaAtMs: null,
      interimOutputTokens: null, // częściowe usage, jeśli provider je daje
    },

    // Statystyki sesji (sumy po assistant messages)
    session: {
      startedAtMs: Date.now(), // fallback: start pluginu; nadpisywane pierwszą wiadomością
      requests: 0,
      messages: 0,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      hasTokenData: false, // false -> Tokens: N/A
      hasCostData: false, // false -> Cost: N/A
    },
    history: { tpsSum: 0, tpsCount: 0, tpsPeak: null }, // avg/peak tok/s
    nowMs: Date.now(),
  };
}

export function createStore() {
  let state = initial();
  const listeners = new Set();
  const emit = () => {
    for (const fn of listeners) fn(state);
  };

  return {
    get state() {
      return state;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** Tick zegara — tylko to pole się zmienia, reszta renderu jest memoizowalna. */
    tick() {
      state.nowMs = Date.now();
      emit();
    },

    setModel(info) {
      // info: { id?, name?, providerID?, providerName?, contextLimit? }
      if (!info) return;
      if ('id' in info) state.model.id = info.id ?? null;
      if ('name' in info) state.model.name = info.name ?? null;
      if ('providerID' in info) state.provider.id = info.providerID ?? null;
      if ('providerName' in info) state.provider.name = info.providerName ?? null;
      if ('contextLimit' in info) state.contextLimit = info.contextLimit ?? null;
      emit();
    },

    setStatus(statusType, retry) {
      state.statusType = statusType ?? null;
      state.retry =
        statusType === 'retry'
          ? { attempt: retry?.attempt ?? null, message: retry?.message ?? null }
          : null;
      state.live.active = statusType === 'busy';
      if (statusType === 'busy' && !state.live.startedAtMs) {
        state.live.startedAtMs = Date.now();
      }
      emit();
    },

    /**
     * Start nowego requestu (event chat.message / step-start).
     * Resetuje metryki "ostatniego" i live okno. Idempotentny dla tego samego
     * messageID — interim updaty nie kasują zmierzonego TTFT.
     */
    beginRequest(messageID, createdMs) {
      const same = messageID != null && state.last.messageID === messageID;
      if (!same) {
        state.last = { ...initial().last, messageID: messageID ?? null };
        state.live.firstDeltaAtMs = null;
        state.live.interimOutputTokens = null;
        state.live.startedAtMs = isNum(createdMs) ? createdMs : Date.now();
        // TTFT liczymy wyłącznie gdy start pochodzi z zegara serwera —
        // mieszanie z lokalnym zegarem dawało fałszywe wartości.
        state.live.startedFromServer = isNum(createdMs);
      } else if (state.live.startedAtMs == null) {
        state.live.startedAtMs = isNum(createdMs) ? createdMs : Date.now();
        state.live.startedFromServer = isNum(createdMs);
      }
      state.live.active = true;
      if (isNum(createdMs)) state.session.startedAtMs = Math.min(state.session.startedAtMs, createdMs);
      emit();
    },

    /** Pierwszy delta tekstu/reasoningu — pomiar TTFT (rzeczywisty). */
    markFirstDelta(tsMs) {
      if (!state.live || state.live.firstDeltaAtMs) return;
      state.live.firstDeltaAtMs = isNum(tsMs) ? tsMs : Date.now();
      const base = state.live.startedAtMs;
      if (isNum(base) && state.live.startedFromServer) {
        const ttft = Math.max(0, state.live.firstDeltaAtMs - base);
        if (!state.last.ttftMs) state.last.ttftMs = ttft;
      }
      emit();
    },

    /** Częściowe usage podczas streamingu (tylko realne dane providera). */
    setInterimOutput(tokens) {
      if (!isNum(tokens) || tokens <= 0) return;
      state.live.interimOutputTokens = tokens;
      emit();
    },

    /**
     * Pełna aktualizacja z assistant message (message.updated / completion).
     * Nadpisuje metryki ostatniego requestu i dolicza sumy sesji.
     */
    applyAssistantMessage(msg, opts = {}) {
      if (!msg || msg.role !== 'assistant') return emit();
      const t = msg.tokens ?? {};
      const cache = t.cache ?? {};
      const time = msg.time ?? {};
      const completed = isNum(time.completed) ? time.completed : null;
      const created = isNum(time.created) ? time.created : null;

      const last = state.last.messageID === msg.id ? state.last : initial().last;
      last.messageID = msg.id;
      last.input = numOr(t.input, last.input);
      last.output = numOr(t.output, last.output);
      last.reasoning = numOr(t.reasoning, last.reasoning);
      last.cacheRead = numOr(cache.read, last.cacheRead);
      last.cacheWrite = numOr(cache.write, last.cacheWrite);
      last.total = numOr(t.total, last.total);
      last.cost = numOr(msg.cost, last.cost);

      if (completed != null && created != null) {
        last.requestMs = Math.max(0, completed - created);
        const genStart = state.live.firstDeltaAtMs ?? created;
        if (completed > genStart) last.generationMs = completed - genStart;
        last.tokPerSec = computeTps(last.output, last.generationMs);
        recordHistory(state.history, last.tokPerSec);
      }

      state.last = last;
      state.live.active = false;
      state.live.interimOutputTokens = null;

      // Sumy sesji — doliczamy raz na messageID (dedupe przy wielokrotnych update'ach)
      if (!opts.skipTotals && !state._counted?.has?.(msg.id)) {
        state._counted = state._counted ?? new Set();
        state._counted.add(msg.id);
        addTotals(state.session, last);
        state.session.requests += 1;
      }
      emit();
    },

    countUserMessage() {
      state.session.messages += 1;
      emit();
    },

    setError() {
      state.statusType = 'error';
      state.live.active = false;
      emit();
    },

    /** Nowa sesja wybrana w TUI — reset kontekstu bieżącego requestu. */
    resetForSessionSwitch(startedAtMs) {
      const fresh = initial();
      fresh.session.startedAtMs = isNum(startedAtMs) ? startedAtMs : Date.now();
      // model/provider/katalog zostają — dotyczą aplikacji, nie sesji
      fresh.model = state.model;
      fresh.provider = state.provider;
      fresh.contextLimit = state.contextLimit;
      fresh.statusType = state.statusType;
      state = fresh;
      emit();
    },
  };
}

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function computeTps(output, generationMs) {
  if (!isNum(output) || output <= 0 || !isNum(generationMs) || generationMs <= 0) return null;
  return (output / generationMs) * 1000;
}

function recordHistory(history, tps) {
  if (!isNum(tps) || tps <= 0) return;
  history.tpsSum += tps;
  history.tpsCount += 1;
  history.tpsPeak = history.tpsPeak == null ? tps : Math.max(history.tpsPeak, tps);
}

function addTotals(session, last) {
  const anyToken = [last.input, last.output].some((v) => isNum(v));
  if (anyToken) session.hasTokenData = true;
  session.inputTokens += last.input ?? 0;
  session.outputTokens += last.output ?? 0;
  if (isNum(last.cost)) {
    session.hasCostData = true;
    session.cost += last.cost;
  }
}

function numOr(value, fallback) {
  return isNum(value) ? value : fallback ?? null;
}

/** Kontekst bieżący: total z ostatniej wiadomości vs limit modelu. */
export function contextUsage(state) {
  const used = state.last.total;
  if (!isNum(used)) return { used: null, ratio: null };
  const ratio = isNum(state.contextLimit) && state.contextLimit > 0 ? used / state.contextLimit : null;
  return { used, ratio };
}

/** Live throughput TYLKO z realnych danych (interim usage providera). */
export function liveTokPerSec(state, nowMs = state.nowMs) {
  const { live } = state;
  if (!live.active || !isNum(live.interimOutputTokens)) return null;
  const start = live.firstDeltaAtMs ?? live.startedAtMs;
  if (!isNum(start)) return null;
  const elapsed = nowMs - start;
  if (elapsed <= 0) return null;
  return computeTps(live.interimOutputTokens, elapsed);
}
