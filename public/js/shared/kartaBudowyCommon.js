// @ts-check
/* Wspólne pola stron Karty Budowy. Logika pozycji i konfiguracji pozostaje domenowa. */

/**
 * @typedef {{ name: string, phone: string, email: string }} Contact
 * @typedef {{
 *   normalizeContacts: (contacts: unknown) => Contact[],
 *   collectContacts: (container: Element | null) => Contact[],
 *   renderEditor: (container: Element | null, contacts: Contact[]) => void,
 *   bindEditor: (container: Element | null) => void,
 *   parseLegacyMirror: (value: string) => Contact[],
 *   contactsToMirrorString: (contacts: Contact[]) => string
 * }} ClientContactsApi
 */

/**
 * Creates the shared party-data adapter used by the classic Rury/Studnie scripts.
 * @param {{ document: Document, clientContacts: ClientContactsApi }} dependencies
 */
export function createKartaBudowyCommon({ document, clientContacts }) {
    const fields = [
        ['clientNumber', 'step4-client-number', 'client-number'],
        ['clientName', 'step4-client-name', 'client-name'],
        ['clientNip', 'step4-client-nip', 'client-nip'],
        ['clientAddress', 'step4-client-address', 'client-address'],
        ['investName', 'step4-invest-name', 'invest-name'],
        ['investPostalCode', 'step4-invest-postal-code', 'invest-postal-code'],
        ['investCity', 'step4-invest-city', 'invest-city'],
        ['investStreet', 'step4-invest-street', 'invest-street'],
        [
            'investLocationDescription',
            'step4-invest-location-description',
            'invest-location-description'
        ]
    ];

    const getElement = (id) => document.getElementById(id);
    const getValue = (id) => getElement(id)?.value?.trim() || '';

    function contactsFrom(source, editorId, arrayKey, mirrorIds, mirrorKey) {
        const editor = getElement(editorId);
        if (editor) return clientContacts.normalizeContacts(clientContacts.collectContacts(editor));

        const saved = clientContacts.normalizeContacts(source[arrayKey]);
        if (saved.length > 0) return saved;

        const mirror = mirrorIds.map(getValue).find(Boolean) || source[mirrorKey] || '';
        return clientContacts.parseLegacyMirror(mirror);
    }

    function renderContacts(id, contacts, mirrorId) {
        const editor = getElement(id);
        if (!editor) return;
        const normalized = clientContacts.normalizeContacts(contacts);
        clientContacts.renderEditor(editor, normalized);
        clientContacts.bindEditor(editor);
        if (mirrorId) {
            const mirror = getElement(mirrorId);
            if (mirror) mirror.value = clientContacts.contactsToMirrorString(normalized);
        }
    }

    function prefill(source = {}) {
        fields.forEach(([key, targetId, sourceId]) => {
            const target = getElement(targetId);
            if (target && !target.value) target.value = getValue(sourceId) || source[key] || '';
        });
        renderContacts(
            'step4-client-contacts',
            contactsFrom(
                source,
                'client-contacts',
                'clientContacts',
                ['client-contact'],
                'clientContact'
            ),
            'step4-osoba-kontakt'
        );
        renderContacts(
            'step4-build-contacts',
            contactsFrom(
                source,
                'invest-contacts',
                'investContacts',
                ['invest-contact'],
                'investContact'
            ),
            null
        );
        syncBuildContactMirrors();
    }

    function syncBuildContactMirrors() {
        const editor = getElement('step4-build-contacts');
        if (!editor) return [];
        const contacts = clientContacts.normalizeContacts(clientContacts.collectContacts(editor));
        const first = contacts[0] || { name: '', phone: '', email: '' };
        [
            ['step4-build-contact-name', first.name],
            ['step4-build-contact-phone', first.phone],
            ['step4-build-contact-email', first.email]
        ].forEach(([id, value]) => {
            const input = getElement(id);
            if (input) input.value = value || '';
        });
        return contacts;
    }

    function collect() {
        const result = Object.fromEntries(fields.map(([key, id]) => [key, getValue(id)]));
        const buyerContacts = clientContacts.normalizeContacts(
            clientContacts.collectContacts(getElement('step4-client-contacts'))
        );
        const buildContacts = syncBuildContactMirrors();
        const firstBuild = buildContacts[0] || { name: '', phone: '', email: '' };
        return {
            ...result,
            clientContacts: buyerContacts,
            kontaktZamawiajacy: buyerContacts,
            kontaktyBudowa: buildContacts,
            kontaktBudowaImie: firstBuild.name || '',
            kontaktBudowaTelefon: firstBuild.phone || '',
            kontaktBudowaEmail: firstBuild.email || '',
            osobaKontakt: clientContacts.contactsToMirrorString(buyerContacts)
        };
    }

    function splitLegacyContact(value) {
        const source = String(value || '');
        const buyer = source.match(/Zamawiający:\s*(.*?)(?=,\s*Budowa:|$)/i)?.[1]?.trim() || '';
        const build = source.match(/Budowa:\s*(.*)$/i)?.[1]?.trim() || '';
        return {
            buyer: buyer ? clientContacts.parseLegacyMirror(buyer) : [],
            build: build ? [{ name: build, phone: '', email: '' }] : []
        };
    }

    function restore(data = {}, options = {}) {
        fields.forEach(([key, targetId]) => {
            if (!Object.prototype.hasOwnProperty.call(data, key)) return;
            const target = getElement(targetId);
            if (target) target.value = data[key] ?? '';
        });

        const split = options.splitLegacyOsobaKontakt
            ? splitLegacyContact(data.osobaKontakt)
            : null;
        const hasLegacyContactLabels = /(?:Zamawiający|Budowa):/i.test(data.osobaKontakt || '');
        const buyer = Array.isArray(data.kontaktZamawiajacy)
            ? data.kontaktZamawiajacy
            : Array.isArray(data.clientContacts)
              ? data.clientContacts
              : split && hasLegacyContactLabels
                ? split.buyer
                : Object.prototype.hasOwnProperty.call(data, 'osobaKontakt') ||
                    Object.prototype.hasOwnProperty.call(data, 'clientContact')
                  ? clientContacts.parseLegacyMirror(data.osobaKontakt || data.clientContact || '')
                  : null;

        const scalarBuild = clientContacts.normalizeContacts([
            {
                name: data.kontaktBudowaImie || '',
                phone: data.kontaktBudowaTelefon || '',
                email: data.kontaktBudowaEmail || ''
            }
        ]);
        const legacyBuild = clientContacts.normalizeContacts(data.investContacts);
        const build = Array.isArray(data.kontaktyBudowa)
            ? data.kontaktyBudowa
            : split?.build?.length
              ? split.build
              : scalarBuild.length > 0
                ? scalarBuild
                : legacyBuild.length > 0
                  ? legacyBuild
                  : data.investContact
                    ? clientContacts.parseLegacyMirror(data.investContact)
                    : null;

        if (buyer !== null) renderContacts('step4-client-contacts', buyer, 'step4-osoba-kontakt');
        if (build !== null) renderContacts('step4-build-contacts', build, null);
        else syncBuildContactMirrors();
    }

    return { prefill, collect, restore };
}
