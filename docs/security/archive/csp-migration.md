# CSP Migration — WITROS Oferty PV

Plan: Faza 3 (po zamknięciu XSS wektorów z Faz 1-2)

## Cel

Zastąpić:

```
script-src 'self' 'unsafe-inline'
```

Docelowo:

```
script-src 'self' 'nonce-{random}'
```

## Przeszkody

### 1. Inline `onclick=""` w szablonach HTML (~320 wystąpień)

Wszystkie `onclick="handler()"` atrybuty w stringach przekazywanych do `innerHTML`
muszą zostać przeniesione do `addEventListener` z `data-*` atrybutami.

Wzorzec docelowy:

```javascript
// ZAMIAST:
element.innerHTML = `<button onclick="handler('${id}')">Kliknij</button>`;

// DOCELOWO:
element.innerHTML = `<button data-action="handler" data-id="${escapeHtml(id)}">Kliknij</button>`;
element.querySelector('[data-action="handler"]').addEventListener('click', handler);
```

### 2. `showModal('...', { html: ... })` w `ui.js:554`

`overlay.innerHTML = opts.html` wstrzykuje HTML z danymi. Wszyscy callerzy
muszą zapewnić, że ich dane są `escapeHtml` przed przekazaniem do showModal.

### 3. `appConfirm` w `ui.js:312`

Opcja `allowHtml: true` omija `_escapeHtml`. Należy sprawdzić wszystkich
callerów używających `allowHtml`.

## Plan migracji

### Krok 1: Audit inline handlerów

Lista: `docs/security/raw-handlers.txt`

Przeskanowaç i sklasyfikować każde wystąpienie jako:

- `INLINE_HTML` — w stringu innerHTML (wymaga migracji)
- `DOM_PROP` — `el.onclick = fn` (CSP-safe, zostaje)
- `ADD_EVENT` — `el.addEventListener(...)` (CSP-safe, zostaje)

### Krok 2: Pilotaż na małym module

Proponowany: `public/js/spa/zlecenia.js` (5 inline onclick, prosty moduł)

1. Zamienić `onclick="AppZlecenia.xxx('${escapeJsStr(id)}')"` na `addEventListener`
2. Użyć `data-id` atrybutów
3. Zweryfikować działanie

### Krok 3: Rozszerzenie na pozostałe moduły

Według priorytetu (od największej liczby inline handlerów):

1. `studnie/pricelistManager.js` (55)
2. `studnie/wellPopups.js` (45)
3. `studnie/excelTableManager.js` (42)
4. `studnie/wellTransitions.js` (44)
5. Pozostałe

### Krok 4: Konfiguracja CSP w Helmet

W `src/app.ts`:

```typescript
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", (req) => `'nonce-${res.locals.nonce}'`]
                // ...
            }
        }
    })
);
```

### Krok 5: Usunięcie `'unsafe-inline'`

Po potwierdzeniu, że wszystkie inline handlery i skrypty są przeniesione.

## Status

| Krok                    | Status          |
| ----------------------- | --------------- |
| Audit inline handlerów  | 📋 Do zrobienia |
| Pilotaż (zlecenia.js)   | 📋 Do zrobienia |
| Rozszerzenie na moduły  | 📋 Do zrobienia |
| Konfiguracja CSP        | 📋 Do zrobienia |
| Usunięcie unsafe-inline | 📋 Do zrobienia |
