// Subskrypcje eventów OpenCode -> store. Wyłącznie event-driven (ETAP 15):
// zero pollingu API, zero własnej telemetrii. Dane pochodzą z tego samego
// strumienia, który zasila wbudowany UI.

export function registerEvents(api, store) {
  const disposers = [];
  const on = (type, handler) => disposers.push(api.event.on(type, handler));
  let trackedSessionID = null;

  // Stan sesji: idle | busy | retry (backoff providera)
  on('session.status', ({ data }) => {
    if (!data || !isCurrent(data.sessionID)) return;
    const st = data.status;
    if (!st) return;
    if (st.type === 'retry') {
      store.setStatus('retry', { attempt: st.attempt, message: st.message });
    } else if (st.type === 'busy' || st.type === 'idle') {
      store.setStatus(st.type);
    }
  });

  // Wiadomości: metryki requestu + sumy sesji + model/provider
  on('message.updated', ({ data }) => {
    if (!data || !isCurrent(data.sessionID)) return;
    const msg = data.info;
    if (!msg) return;

    if (msg.role === 'assistant') {
      resolveModel(api, store, msg.providerID, msg.modelID);
      if (msg.time && typeof msg.time.completed === 'number') {
        store.applyAssistantMessage(msg);
      } else {
        // Streaming w toku: załóż okno live + interim usage (jeśli realny)
        store.beginRequest(msg.id, msg.time ? msg.time.created : undefined);
        if (msg.tokens && typeof msg.tokens.output === 'number') {
          store.setInterimOutput(msg.tokens.output);
        }
      }
    } else if (msg.role === 'user') {
      store.countUserMessage();
    }
  });

  // Pierwszy delta = pomiar TTFT (timestamp z serwera, nie lokalny zegar)
  const firstDelta = ({ data }) => {
    if (!data || !isCurrent(data.sessionID)) return;
    store.markFirstDelta(data.timestamp);
  };
  on('session.next.text.delta', firstDelta);
  on('session.next.reasoning.delta', firstDelta);

  on('session.error', () => store.setError());

  // Zmiana sesji w TUI wykrywana w timere widoku (route.current nie ma eventu)
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
 * Nazwa modelu/providera + limit kontekstu z zsynchronizowanego katalogu
 * api.state.provider (dane models.dev). Zero zapytań sieciowych.
 * Brak wpisu -> zostaje ID surowy (nigdy nie zgadujemy nazwy).
 */
export function resolveModel(api, store, providerID, modelID) {
  if (!providerID && !modelID) return;
  const providers = safeProviders(api);
  const provider = providerID ? providers.find((p) => p && p.id === providerID) : undefined;
  const model = provider && modelID ? provider.models?.[modelID] : undefined;
  store.setModel({
    id: modelID ?? null,
    name: model?.name ?? null,
    providerID: providerID ?? null,
    providerName: provider?.name ?? null,
    contextLimit: model?.limit?.context ?? null,
  });
}

function safeProviders(api) {
  try {
    return Array.isArray(api.state?.provider) ? api.state.provider : [];
  } catch {
    return [];
  }
}

/** Seed danych istniejącej sesji (start plugina w trakcie sesji / przełączenie). */
export function seedSession(api, store, sessionID) {
  try {
    const session = api.state?.session?.get?.(sessionID);
    if (session?.model) {
      resolveModel(api, store, session.model.providerID, session.model.id);
    }
    if (session?.time?.created) {
      store.resetForSessionSwitch(session.time.created);
    } else {
      store.resetForSessionSwitch(Date.now());
    }

    const messages = api.state?.session?.messages?.(sessionID) ?? [];
    for (const msg of messages) {
      if (msg.role === 'assistant') {
        store.applyAssistantMessage(msg);
        if (msg.providerID || msg.modelID) {
          resolveModel(api, store, msg.providerID, msg.modelID);
        }
      }
    }
  } catch (err) {
    reportErr(api, 'seedSession', err);
  }
}

export function reportErr(api, scope, err) {
  try {
    void api.client?.app?.log({
      body: {
        service: 'sok.status-bar',
        level: 'warn',
        message: `${scope}: ${err instanceof Error ? err.message : String(err)}`,
      },
    });
  } catch {
    // logowanie nie może nigdy wywalić plugina
  }
}
