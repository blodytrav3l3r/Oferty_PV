// Subskrypcje eventów OpenCode -> store. Wyłącznie event-driven:
// zero pollingu API, zero własnej telemetrii. Dane pochodzą z tego samego
// strumienia, który zasila wbudowany UI.
//
// Kontrakt: OpenCode 2 (https://opencode.ai/v2/docs/build/plugins/cli).
// Mapowanie nazw eventów z 1.x, na których opierał się ten plugin:
//   message.updated (assistant, streaming)  -> session.step.started
//   message.updated (assistant, ukończona)  -> session.execution.succeeded + cache wiadomości
//   message.updated (user)                  -> session.inbox.enqueued
//   session.next.text.delta                 -> session.text.delta
//   session.next.reasoning.delta            -> session.reasoning.delta
//   session.error                           -> session.execution.failed
//   state.provider / state.session          -> data.location.* / data.session.*

export function registerEvents(api, store) {
  const disposers = [];
  const on = (type, handler) => disposers.push(api.data.on(type, handler));
  let trackedSessionID = null;
  let currentMessageID = null;

  // Stan sesji: idle | busy | retry (backoff providera)
  on('session.status', (event) => {
    const data = event.data;
    if (!data || !isCurrent(data.sessionID)) return;
    const st = data.status;
    if (!st) return;
    if (st.type === 'retry') {
      store.setStatus('retry', { attempt: st.attempt, message: st.message });
    } else if (st.type === 'busy' || st.type === 'idle') {
      store.setStatus(st.type);
    }
  });

  // Start kroku asystenta: model + zegar serwera. `started` jest czasem serwera,
  // więc TTFT liczone względem niego nie miesza zegarów.
  on('session.step.started', (event) => {
    const data = event.data;
    if (!data || !isCurrent(data.sessionID)) return;
    currentMessageID = data.assistantMessageID ?? null;
    if (data.model) resolveModel(api, store, data.model.providerID, data.model.id);
    store.beginRequest(currentMessageID, data.started);
  });

  // Pierwsza delta = pomiar TTFT (timestamp z serwera, nie lokalny zegar)
  const firstDelta = (event) => {
    const data = event.data;
    if (!data || !isCurrent(data.sessionID)) return;
    store.markFirstDelta(event.created);
  };
  on('session.text.delta', firstDelta);
  on('session.reasoning.delta', firstDelta);

  // Koniec wykonania: metryki requestu z wiadomości asystenta w cache.
  // V2 nie powtarza treści w evencie, więc czytamy zsynchronizowany katalog.
  on('session.execution.succeeded', (event) => {
    const data = event.data;
    if (!data || !isCurrent(data.sessionID)) return;
    const msg = findAssistantMessage(api, data.sessionID, currentMessageID);
    if (msg) {
      store.applyAssistantMessage(toStoreMessage(msg));
      if (msg.model) resolveModel(api, store, msg.model.providerID, msg.model.id);
    }
    currentMessageID = null;
  });

  on('session.execution.failed', (event) => {
    const data = event.data;
    if (!data || !isCurrent(data.sessionID)) return;
    store.setError();
    currentMessageID = null;
  });

  // Prompt użytkownika = jedno wejście do skrzynki sesji.
  on('session.inbox.enqueued', (event) => {
    const data = event.data;
    if (!data || !isCurrent(data.sessionID)) return;
    store.countUserMessage();
  });

  // Zmiana sesji w TUI wykrywana w timere widoku (router nie ma eventu)
  return {
    /** Wywoływane cyklicznie przez timer: przełącza kontekst przy zmianie sesji. */
    syncRouteSession(sessionID, seedFn) {
      if (!sessionID || sessionID === trackedSessionID) return false;
      trackedSessionID = sessionID;
      seedFn(sessionID);
      return true;
    },
    dispose() {
      for (const off of disposers) {
        try {
          off();
        } catch {
          // cleanup best-effort — host i tak sprząta subskrypcje plugina
        }
      }
    },
  };

  function isCurrent(sessionID) {
    // Przed pierwszym synciem przyjmujemy wszystko (home / świeży start).
    return trackedSessionID == null || sessionID === trackedSessionID;
  }
}

/**
 * Nazwa modelu/providera + limit kontekstu z katalogu modeli OpenCode.
 * Zero zapytań sieciowych. Brak wpisu -> zostaje ID surowy (nigdy nie
 * zgadujemy nazwy).
 */
export function resolveModel(api, store, providerID, modelID) {
  if (!providerID && !modelID) return;
  const model = modelID
    ? listModels(api).find(
        (m) => m && m.modelID === modelID && (!providerID || m.providerID === providerID),
      )
    : undefined;
  const provider = providerID ? listProviders(api).find((p) => p && p.id === providerID) : undefined;
  store.setModel({
    id: modelID ?? null,
    name: model?.name ?? null,
    providerID: providerID ?? null,
    providerName: provider?.name ?? null,
    contextLimit: model?.limit?.context ?? null,
  });
}

function listModels(api) {
  try {
    const models = api.data?.location?.model?.list?.();
    return Array.isArray(models) ? models : [];
  } catch {
    return [];
  }
}

function listProviders(api) {
  try {
    const providers = api.data?.location?.provider?.list?.();
    return Array.isArray(providers) ? providers : [];
  } catch {
    return [];
  }
}

/** Seed danych istniejącej sesji (start plugina w trakcie sesji / przełączenie). */
export function seedSession(api, store, sessionID) {
  try {
    const session = api.data?.session?.get?.(sessionID);
    if (session?.model) {
      resolveModel(api, store, session.model.providerID, session.model.id);
    }
    store.resetForSessionSwitch(session?.time?.created ?? Date.now());

    const messages = api.data?.session?.message?.list?.(sessionID) ?? [];
    for (const msg of messages) {
      if (msg?.type === 'assistant') {
        store.applyAssistantMessage(toStoreMessage(msg));
        if (msg.model) resolveModel(api, store, msg.model.providerID, msg.model.id);
      } else if (msg?.type === 'user') {
        store.countUserMessage();
      }
    }
  } catch (err) {
    reportErr(api, 'seedSession', err);
  }
}

function findAssistantMessage(api, sessionID, messageID) {
  try {
    const list = () => api.data?.session?.message?.list?.(sessionID) ?? [];
    let msg = messageID ? list().find((m) => m?.id === messageID) : undefined;
    if (!msg) {
      // Cache mógł nie dojechać przed eventem — ostatnia wiadomość asystenta.
      const assistants = list().filter((m) => m?.type === 'assistant');
      msg = assistants[assistants.length - 1];
    }
    return msg?.type === 'assistant' ? msg : undefined;
  } catch (err) {
    reportErr(api, 'findAssistantMessage', err);
    return undefined;
  }
}

/**
 * Wiadomość asystenta V2 -> kształt, który rozumie lib/state.js.
 * `total` nie istnieje w V2 (TokenUsageInfo), więc liczymy sumę zużytych
 * tokenów — tak jak robił to provider w 1.x.
 */
export function toStoreMessage(msg) {
  const tokens = msg.tokens ?? {};
  const cache = tokens.cache ?? {};
  return {
    id: msg.id,
    role: 'assistant',
    providerID: msg.model?.providerID,
    modelID: msg.model?.id,
    cost: msg.cost,
    time: msg.time,
    tokens: {
      input: tokens.input,
      output: tokens.output,
      reasoning: tokens.reasoning,
      cache: { read: cache.read, write: cache.write },
      total: sumTokens(tokens.input, tokens.output, tokens.reasoning, cache.read, cache.write),
    },
  };
}

function sumTokens(...values) {
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
}

export function reportErr(api, scope, err) {
  // V2 nie ma client.app.log, a plugin TUI nie ma własnego loggera — błąd idzie
  // do toasta, więc nie ginie po cichu i nie zaśmieca renderu.
  try {
    api?.ui?.toast?.show?.({
      message: `${scope}: ${err instanceof Error ? err.message : String(err)}`,
      variant: 'error',
    });
  } catch {
    // raportowanie nie może nigdy wywalić plugina
  }
}
