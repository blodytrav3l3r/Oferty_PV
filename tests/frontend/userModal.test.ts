/**
 * @jest-environment jsdom
 */

// @ts-nocheck
/**
 * Modal użytkownika (create + edit) na prawdziwym DOM.
 * dashboard.js (legacy global) + modalCore.js (ESM przez vm) w jednym kontekście,
 * żeby sprawdzić realne zachowanie: focus, Escape, click-outside, walidacja, XSS.
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';

const esc = (s: unknown) =>
    String(s ?? '').replace(
        /[&<>"']/g,
        (c) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
    );

const flush = async (n = 30) => {
    for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

const okJson = (payload: unknown) => ({ ok: true, json: async () => payload });

const victim = {
    id: 'v',
    username: 'vict',
    role: 'user',
    firstName: 'Wiktor',
    lastName: 'Nowak',
    email: 'v@e.pl',
    phone: '600100200',
    symbol: 'WN',
    orderStartNumber: 5,
    productionOrderStartNumber: 7,
    subUsers: []
};

function loadDashboard(fetchImpl: any) {
    // modalCore.js (ESM) — ten sam wzorzec co modalScrollGuard/excelTabFocus.
    const modalCode = fs
        .readFileSync(path.join(process.cwd(), 'public/js/shared/modalCore.js'), 'utf-8')
        .replace(/import\s+.*from\s+['"].*['"];?/, '')
        .replace(/export function/g, 'function');
    const modalCtx: any = {
        document,
        window: { getComputedStyle: (el: Element) => window.getComputedStyle(el) },
        setTimeout,
        escapeHtml: esc
    };
    vm.createContext(modalCtx);
    vm.runInContext(modalCode, modalCtx, { filename: 'modalCore.js' });

    const context: any = {
        console,
        document,
        setTimeout,
        clearTimeout,
        setInterval: () => 0,
        clearInterval() {},
        fetch: jest.fn(fetchImpl),
        escapeHtml: esc,
        escapeHtmlAttr: esc,
        logger: { info() {}, warn: jest.fn(), error: jest.fn() },
        showToast: jest.fn(),
        sessionStorage: { getItem: () => null, setItem() {} },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        CustomEvent: window.CustomEvent
    };
    context.window = {
        addEventListener() {},
        headerUser: null,
        location: { href: '' },
        appConfirm: jest.fn(async () => true),
        showToast: context.showToast,
        showModal: modalCtx.window.showModal,
        closeModal: modalCtx.window.closeModal,
        restoreBodyScroll: modalCtx.window.restoreBodyScroll,
        trapFocus: modalCtx.window.trapFocus,
        untrapFocus: modalCtx.window.untrapFocus
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync('public/js/shared/dashboard.js', 'utf-8'), context, {
        filename: 'dashboard.js'
    });
    return context;
}

/** Fetch: users lista, sesje puste, zapis konta OK. */
function defaultFetch(users: any[] = [victim]) {
    return async (url: string) => {
        const u = String(url);
        if (u.endsWith('/api/users')) return okJson({ data: users });
        if (u.includes('/api/admin/sessions')) return okJson({ data: [], summary: {} });
        return okJson({ ok: true });
    };
}

async function openCreate(context: any) {
    context.openUserModal();
    await flush(2);
    return document.getElementById('user-modal') as HTMLElement;
}

async function openEdit(context: any) {
    await context.loadUsers();
    await flush();
    context.openUserModal('v');
    await flush(2);
    return document.getElementById('user-modal') as HTMLElement;
}

function submit(overlay: HTMLElement) {
    const form = overlay.querySelector('#user-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function setValue(id: string, value: string) {
    (document.getElementById(id) as HTMLInputElement).value = value;
}

describe('frontend jsdom: modal użytkownika', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="users-tiles"></div><div id="session-tiles"></div>';
        document.body.style.overflow = '';
    });

    afterEach(() => {
        document.querySelectorAll('.js-modal-overlay').forEach((el) => el.remove());
        document.body.style.overflow = '';
    });

    it('create: dialog ARIA, puste pola, focus w pierwszym polu', async () => {
        const context = loadDashboard(defaultFetch());
        const overlay = await openCreate(context);

        expect(overlay).not.toBeNull();
        expect(overlay.getAttribute('role')).toBe('dialog');
        expect(overlay.getAttribute('aria-modal')).toBe('true');
        expect(overlay.getAttribute('aria-labelledby')).toBe('user-modal-title');
        expect(overlay.querySelector('#user-modal-title')?.textContent).toContain(
            'Nowy użytkownik'
        );
        expect(document.body.style.overflow).toBe('hidden');

        for (const id of [
            'new-user-firstname',
            'new-user-lastname',
            'new-user-symbol',
            'new-user-login',
            'new-user-password',
            'new-user-email',
            'new-user-phone'
        ]) {
            expect((document.getElementById(id) as HTMLInputElement).value).toBe('');
        }
        expect((document.getElementById('new-user-order-start') as HTMLInputElement).value).toBe(
            '1'
        );
        expect(document.activeElement?.id).toBe('new-user-firstname');
    });

    it('edit: prefill, hasło puste z podpowiedzią, badge trybu edycji', async () => {
        const context = loadDashboard(defaultFetch());
        const overlay = await openEdit(context);

        expect((document.getElementById('new-user-firstname') as HTMLInputElement).value).toBe(
            'Wiktor'
        );
        expect((document.getElementById('new-user-lastname') as HTMLInputElement).value).toBe(
            'Nowak'
        );
        expect((document.getElementById('new-user-login') as HTMLInputElement).value).toBe('vict');
        expect((document.getElementById('new-user-email') as HTMLInputElement).value).toBe(
            'v@e.pl'
        );
        expect((document.getElementById('new-user-symbol') as HTMLInputElement).value).toBe('WN');
        expect((document.getElementById('new-user-order-start') as HTMLInputElement).value).toBe(
            '5'
        );

        const pwd = document.getElementById('new-user-password') as HTMLInputElement;
        expect(pwd.value).toBe('');
        expect(pwd.placeholder).toBe('Nowe hasło (opcjonalnie)');

        expect(overlay.querySelector('#form-mode-label')?.classList.contains('hidden')).toBe(false);
        expect(overlay.querySelector('#add-user-btn')?.textContent).toContain('Zapisz');
    });

    it('walidacja: pusty login → alert, brak fetch, focus na polu', async () => {
        const context = loadDashboard(defaultFetch());
        const overlay = await openCreate(context);
        context.fetch.mockClear();

        submit(overlay);
        await flush(2);

        const error = document.getElementById('user-form-error') as HTMLElement;
        expect(error.getAttribute('role')).toBe('alert');
        expect(error.textContent).toBe('Login musi mieć co najmniej 3 znaki');
        expect(context.fetch).not.toHaveBeenCalled();
        expect(document.activeElement?.id).toBe('new-user-login');
        expect(document.getElementById('new-user-login')?.getAttribute('aria-invalid')).toBe(
            'true'
        );
        expect(document.getElementById('user-modal')).not.toBeNull();
    });

    it('walidacja: hasło < 8 znaków i zły email', async () => {
        const context = loadDashboard(defaultFetch());
        const overlay = await openCreate(context);
        context.fetch.mockClear();

        setValue('new-user-login', 'nowy');
        setValue('new-user-password', 'krotkie');
        submit(overlay);
        await flush(2);
        expect((document.getElementById('user-form-error') as HTMLElement).textContent).toBe(
            'Hasło musi mieć przynajmniej 8 znaków'
        );

        setValue('new-user-password', 'haslo1234');
        setValue('new-user-email', 'nie-email');
        submit(overlay);
        await flush(2);
        expect((document.getElementById('user-form-error') as HTMLElement).textContent).toBe(
            'Niepoprawny format email'
        );
        expect(context.fetch).not.toHaveBeenCalled();
    });

    it('create: POST /api/auth/register z payloadem, modal zamknięty, overflow wraca', async () => {
        const context = loadDashboard(defaultFetch());
        const overlay = await openCreate(context);

        setValue('new-user-firstname', 'Jan');
        setValue('new-user-lastname', 'Nowak');
        setValue('new-user-symbol', 'JN');
        setValue('new-user-login', 'janek');
        setValue('new-user-password', 'haslo1234');
        setValue('new-user-email', 'jan@e.pl');
        setValue('new-user-phone', '600700800');
        setValue('new-user-order-start', '3');
        setValue('new-user-prod-order-start', '4');
        submit(overlay);
        await flush();

        const call = context.fetch.mock.calls.find((c: any[]) =>
            String(c[0]).includes('/api/auth/register')
        );
        expect(call).toBeTruthy();
        expect(call[1].method).toBe('POST');
        const body = JSON.parse(call[1].body);
        expect(body).toMatchObject({
            username: 'janek',
            password: 'haslo1234',
            role: 'user',
            firstName: 'Jan',
            lastName: 'Nowak',
            symbol: 'JN',
            email: 'jan@e.pl',
            phone: '600700800',
            subUsers: [],
            orderStartNumber: 3,
            productionOrderStartNumber: 4
        });
        expect(document.getElementById('user-modal')).toBeNull();
        expect(document.body.style.overflow).toBe('');
    });

    it('edit: PUT /api/users/:id, hasło pominięte gdy puste', async () => {
        const context = loadDashboard(defaultFetch());
        const overlay = await openEdit(context);
        setValue('new-user-lastname', 'Kowalski');
        submit(overlay);
        await flush();

        const call = context.fetch.mock.calls.find((c: any[]) =>
            String(c[0]).includes('/api/users/v')
        );
        expect(call).toBeTruthy();
        expect(call[1].method).toBe('PUT');
        const body = JSON.parse(call[1].body);
        expect(body.lastName).toBe('Kowalski');
        expect('password' in body).toBe(false);
        expect(document.getElementById('user-modal')).toBeNull();
    });

    it('XSS: nazwa z HTML escapowana w tytule modala', async () => {
        const evil = { ...victim, firstName: '<img src=x onerror=alert(1)>' };
        const context = loadDashboard(defaultFetch([evil]));
        const overlay = await openEdit(context);

        const title = overlay.querySelector('#user-modal-title') as HTMLElement;
        expect(title.textContent).toContain('<img src=x onerror=alert(1)>');
        expect(overlay.querySelectorAll('img')).toHaveLength(0);
        expect(overlay.querySelector('[onerror]')).toBeNull();
        // Wartość trafia do atrybutu value, nie do treści jako znacznik.
        expect((document.getElementById('new-user-firstname') as HTMLInputElement).value).toBe(
            '<img src=x onerror=alert(1)>'
        );
    });

    it('Escape i click poza modalem zamykają; Anuluj zamyka bez requestu', async () => {
        const context = loadDashboard(defaultFetch());
        let overlay = await openCreate(context);
        overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(document.getElementById('user-modal')).toBeNull();
        expect(document.body.style.overflow).toBe('');

        overlay = await openCreate(context);
        overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(document.getElementById('user-modal')).toBeNull();

        overlay = await openCreate(context);
        expect(overlay.querySelector('[data-csp="closeUserModal"]')).not.toBeNull();
        context.fetch.mockClear();
        context.closeUserModal();
        await flush(2);
        expect(context.fetch).not.toHaveBeenCalled();
        expect(document.getElementById('user-modal')).toBeNull();
    });

    it('podwójny submit → jedno żądanie', async () => {
        const context = loadDashboard(defaultFetch());
        const overlay = await openCreate(context);
        setValue('new-user-login', 'janek');
        setValue('new-user-password', 'haslo1234');
        context.fetch.mockClear();

        submit(overlay);
        submit(overlay);
        await flush();

        const posts = context.fetch.mock.calls.filter((c: any[]) =>
            String(c[0]).includes('/api/auth/register')
        );
        expect(posts).toHaveLength(1);
    });
});
