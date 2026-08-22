/** @jsxImportSource @opentui/solid */
// S.O.K. Status Bar — plugin TUI OpenCode.
// Provider-agnostic: wszystkie dane z eventów i katalogu OpenCode (ETAP 0),
// zero pollingu, zero własnej telemetrii, zero zgadywanych wartości (ETAP 21).

import type { TuiPlugin, TuiPluginModule } from '@opencode-ai/plugin/tui';
import { createStore } from './lib/state.js';
import { registerEvents, seedSession, reportErr } from './lib/events.js';
import { StatusBarView, DetailsDialog } from './lib/view.tsx';

const TICK_MS = 1000;

const tui: TuiPlugin = async (api) => {
  const store = createStore();
  const bus = registerEvents(api, store);

  // Seed istniejącej sesji przy starcie plugina (Etap: restart aplikacji)
  try {
    const route = api.route.current;
    const sid = route?.name === 'session' ? route.params?.sessionID : undefined;
    if (sid) seedSession(api, store, sid);
  } catch (err) {
    reportErr(api, 'initial-seed', err);
  }

  // Jedyny timer: tick zegara sesji + detekcja zmiany sesji w routingu.
  // Aktualizuje wyłącznie sygnał Status Bara — nie dotyka reszty UI (ETAP 8/15).
  const timer = setInterval(() => {
    store.tick();
    try {
      const route = api.route.current;
      const sid = route?.name === 'session' ? route.params?.sessionID : undefined;
      bus.syncRouteSession(sid, (id) => seedSession(api, store, id));
    } catch {
      // routing jeszcze nie gotowy — tick bez zmian
    }
  }, TICK_MS);
  api.lifecycle.onDispose(() => {
    clearInterval(timer);
    bus.dispose();
  });

  api.slots.register({
    order: 900,
    slots: {
      app_bottom: () => <StatusBarView api={api} store={store} />,
    },
  });

  let detailsOpen = false;
  const toggleDetails = () => {
    if (detailsOpen) {
      api.ui.dialog.clear();
      detailsOpen = false;
      return;
    }
    detailsOpen = true;
    api.ui.dialog.replace(() => {
      return (
        <DetailsDialog
          store={store}
          theme={api.theme?.current}
          onClose={() => {
            detailsOpen = false;
          }}
        />
      );
    }, () => {
      detailsOpen = false;
    });
  };

  api.keymap.registerLayer({
    commands: [
      {
        name: 'statusbar.details',
        title: 'Status bar: szczegóły',
        category: 'Plugin',
        namespace: 'palette',
        slashName: 'status',
        run: toggleDetails,
      },
    ],
    bindings: [{ key: 'ctrl+shift+s', cmd: 'statusbar.details', desc: 'Status bar szczegóły' }],
  });
};

export default { id: 'sok.status-bar', tui } satisfies TuiPluginModule;
