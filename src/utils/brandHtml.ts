import { APP_NAME, APP_SUBTITLE } from '../constants/appMeta';

/** Escapuje wartość do kontekstu HTML (treść i atrybuty) — zabezpieczenie XSS. */
function escapeHtmlValue(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Podmienia tokeny nazwy aplikacji w serwowanym HTML.
 *
 * Statyczne strony (public/*.html) zawierają tokeny {{APP_NAME}} i
 * {{APP_SUBTITLE}} zamiast twardo zakodowanej nazwy — dzięki temu aplikacja
 * jest niezależna od nazwy (S.O.K., WITROS itd.), a nazwę ustawia się przez
 * zmienne środowiskowe APP_NAME/APP_SUBTITLE.
 */
export function applyBrandTokens(html: string): string {
    return html
        .replaceAll('{{APP_NAME}}', escapeHtmlValue(APP_NAME))
        .replaceAll('{{APP_SUBTITLE}}', escapeHtmlValue(APP_SUBTITLE));
}

/**
 * Wstrzykuje globalną zmienną window.APP_NAME (JSON-escaped) przed </head> —
 * frontend (np. orderEditMode.js) używa jej zamiast twardej nazwy.
 * `<` jest zamieniane na \u003c, aby nazwa zawierająca `</script>` nie
 * przerwała wstrzykniętego skryptu. Opcjonalny nonce CSP (res.locals.cspNonce)
 * zapobiega zgłaszaniu violacji przez report-only CSP.
 */
export function injectAppNameScript(html: string, nonce?: string): string {
    const nonceAttr = nonce ? ` nonce="${nonce}"` : '';
    const script = `<script${nonceAttr}>window.APP_NAME=${JSON.stringify(APP_NAME).replace(/</g, '\\u003c')};</script>`;
    if (html.includes('</head>')) {
        return html.replace('</head>', script + '</head>');
    }
    return script + html;
}
