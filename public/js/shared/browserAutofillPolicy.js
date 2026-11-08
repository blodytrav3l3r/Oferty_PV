const FORM_CONTROL_SELECTOR = 'input, textarea, select';
const CREDENTIAL_AUTOCOMPLETE_VALUES = new Set(['username', 'current-password', 'new-password']);

function isCredentialControl(control) {
    const tokens = (control.getAttribute('autocomplete') || '').toLowerCase().split(/\s+/);
    return tokens.some((token) => CREDENTIAL_AUTOCOMPLETE_VALUES.has(token));
}

function applyToControl(control) {
    if (control instanceof HTMLInputElement && control.type === 'hidden') return;
    if (isCredentialControl(control)) return;
    control.setAttribute('autocomplete', 'off');
}

function applyToSubtree(root) {
    if (!(root instanceof Element)) return;
    if (root.matches(FORM_CONTROL_SELECTOR)) applyToControl(root);
    root.querySelectorAll(FORM_CONTROL_SELECTOR).forEach(applyToControl);
}

function initializeBrowserAutofillPolicy() {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
    const root = document.documentElement;
    if (!root) return;

    applyToSubtree(root);
    const observer = new MutationObserver((records) => {
        records.forEach((record) => record.addedNodes.forEach(applyToSubtree));
    });
    observer.observe(root, { childList: true, subtree: true });
}

initializeBrowserAutofillPolicy();
