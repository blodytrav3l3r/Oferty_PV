// @ts-check
/* ===== WSPÓLNE HELPERY CRUD OFERT ===== */
/* Używane przez: offerCrud.js (rury), offerSave.js i offerManager.js (studnie) */

/**
 * Edytor osób do kontaktu (wiele wierszy) — render + zbiórka.
 * Ukryte #client-contact to mirror legacy (pierwsza osoba), więc stare
 * ścieżki (baza klientów, zamówienia, eksport) działają bez zmian.
 */
function getClientContactsList() {
    const box = document.getElementById('client-contacts');
    if (box && typeof window.ClientContacts !== 'undefined') {
        return window.ClientContacts.collectContacts(box);
    }
    return [];
}

function renderClientContactsList(list, legacy) {
    const box = document.getElementById('client-contacts');
    if (!box || typeof window.ClientContacts === 'undefined') return;
    let rows = Array.isArray(list) && list.length > 0 ? list : null;
    if (!rows || rows.length === 0) {
        rows = window.ClientContacts.legacyToContacts(legacy || {});
    }
    if (rows.length === 0) {
        rows = window.ClientContacts.parseLegacyMirror(
            (legacy && legacy.clientContact) ||
                document.getElementById('client-contact')?.value ||
                ''
        );
    }
    window.ClientContacts.renderEditor(box, rows);
    window.ClientContacts.bindEditor(box);
}

function getInvestContactsList() {
    const box = document.getElementById('invest-contacts');
    if (box && typeof window.ClientContacts !== 'undefined') {
        return window.ClientContacts.collectContacts(box);
    }
    return [];
}

function renderInvestContactsList(list, legacy) {
    const box = document.getElementById('invest-contacts');
    if (!box || typeof window.ClientContacts === 'undefined') return;
    const legacyContact =
        legacy && Object.prototype.hasOwnProperty.call(legacy, 'investContact')
            ? legacy.investContact
            : document.getElementById('invest-contact')?.value || '';
    const rows =
        Array.isArray(list) && list.length > 0
            ? list
            : window.ClientContacts.parseLegacyMirror(legacyContact || '');
    window.ClientContacts.renderEditor(box, rows);
    window.ClientContacts.bindEditor(box);
}

function ensureInvestCountryOptions() {
    const select = /** @type {HTMLSelectElement | null} */ (
        /** @type {unknown} */ (document.getElementById('invest-country'))
    );
    if (!select || select.dataset.countriesReady === 'true') return;
    const codes =
        'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
            ' '
        );
    const displayNames =
        typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
            ? new Intl.DisplayNames(['pl'], { type: 'region' })
            : null;
    const countries = codes
        .map((code) => ({ code, name: displayNames?.of(code) || code }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
    countries.sort((a, b) => (a.code === 'PL' ? -1 : b.code === 'PL' ? 1 : 0));
    select.textContent = '';
    countries.forEach(({ code, name }) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = name;
        select.appendChild(option);
    });
    select.dataset.countriesReady = 'true';
}

function getInvestCountryName() {
    const select = /** @type {HTMLSelectElement | null} */ (
        /** @type {unknown} */ (document.getElementById('invest-country'))
    );
    const selected = select?.options?.[select.selectedIndex];
    return selected?.textContent?.trim() || 'Polska';
}

function syncInvestAddressMirror() {
    const street = document.getElementById('invest-street')?.value?.trim() || '';
    const postalCode = document.getElementById('invest-postal-code')?.value?.trim() || '';
    const city = document.getElementById('invest-city')?.value?.trim() || '';
    const legacy = document.getElementById('invest-address')?.value?.trim() || '';
    let address = legacy;
    if (street || postalCode || city) {
        const postalCity = [postalCode, city].filter(Boolean).join(' ');
        address = [street, postalCity, getInvestCountryName()].filter(Boolean).join(', ');
        if (street === legacy && !postalCode && !city) address = legacy;
    }
    const mirror = document.getElementById('invest-address');
    if (mirror) mirror.value = address;
    return address;
}

function bindInvestAddressMirror() {
    const container = document.getElementById('invest-location-fields');
    if (!container || container.dataset.investAddressBound === 'true') return;
    container.dataset.investAddressBound = 'true';
    container.addEventListener('input', syncInvestAddressMirror);
    container.addEventListener('change', syncInvestAddressMirror);
}

function getInvestLocationFields() {
    const streetInput = document.getElementById('invest-street');
    if (!streetInput) return null;
    return {
        investAddress: syncInvestAddressMirror(),
        investStreet: streetInput.value.trim(),
        investPostalCode: document.getElementById('invest-postal-code')?.value?.trim() || '',
        investCity: document.getElementById('invest-city')?.value?.trim() || '',
        investCountry: document.getElementById('invest-country')?.value || 'PL',
        investLocationDescription:
            document.getElementById('invest-location-description')?.value?.trim() || '',
        investContact: document.getElementById('invest-contact')?.value?.trim() || '',
        investContacts: getInvestContactsList()
    };
}

/**
 * Zbiera standardowe pola formularza oferty.
 * @returns {{number:string,date:string,organizationUnit:string,clientName:string,clientNumber:string,clientNip:string,clientAddress:string,clientContact:string,clientContacts:Array,contactPerson:string,clientPhone:string,clientEmail:string,investName:string,investAddress:string,investContractor:string,investStreet?:string,investPostalCode?:string,investCity?:string,investCountry?:string,investLocationDescription?:string,investContact?:string,investContacts?:Array,notes:string,paymentTerms:string,validity:string,transportKm:number,transportRate:number}}
 */
function getOfferFormFields() {
    const g = (id) => (document.getElementById(id)?.value ?? '').trim();
    const clientContacts = getClientContactsList();
    const first = Array.isArray(clientContacts) ? clientContacts[0] || {} : {};
    const investmentFields = getInvestLocationFields();
    return {
        number: g('offer-number'),
        date: document.getElementById('offer-date')?.value || '',
        organizationUnit: g('offer-organization-unit'),
        clientName: g('client-name'),
        clientNumber: g('client-number'),
        clientNip: g('client-nip'),
        clientAddress: g('client-address'),
        clientContact: g('client-contact'),
        clientContacts: clientContacts,
        contactPerson: String(first.name || ''),
        clientPhone: String(first.phone || ''),
        clientEmail: String(first.email || ''),
        investName: g('invest-name'),
        investAddress: investmentFields ? investmentFields.investAddress : g('invest-address'),
        investContractor: g('invest-contractor'),
        ...(investmentFields || {}),
        notes:
            document.getElementById('offer-tab-notes')?.value.trim() ||
            document.getElementById('offer-notes')?.value.trim() ||
            '',
        paymentTerms:
            document.getElementById('offer-tab-payment-terms')?.value.trim() ||
            document.getElementById('offer-payment-terms')?.value.trim() ||
            'Do uzgodnienia lub według indywidualnych warunków handlowych.',
        validity:
            document.getElementById('offer-tab-validity')?.value.trim() ||
            document.getElementById('offer-validity')?.value.trim() ||
            '7 dni',
        transportKm: Number(document.getElementById('transport-km')?.value) || 0,
        transportRate: Number(document.getElementById('transport-rate')?.value) || 0
    };
}

/**
 * Wypełnia standardowe pola formularza oferty danymi.
 * @param {{number?:string,date?:string,organizationUnit?:string,clientName?:string,clientNumber?:string,clientNip?:string,clientAddress?:string,clientContact?:string,clientContacts?:Array,contactPerson?:string,clientPhone?:string,clientEmail?:string,investName?:string,investAddress?:string,investContractor?:string,investStreet?:string,investPostalCode?:string,investCity?:string,investCountry?:string,investLocationDescription?:string,investContact?:string,investContacts?:Array,notes?:string,paymentTerms?:string,validity?:string,transportKm?:number,transportRate?:number}} data
 */
function setOfferFormFields(data) {
    const numberInput = document.getElementById('offer-number');
    if (numberInput) numberInput.dataset.numberGenerated = 'false';
    const s = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined) el.value = val ?? '';
    };
    s('offer-number', data.number);
    s('offer-date', data.date || new Date().toISOString().slice(0, 10));
    s('offer-organization-unit', data.organizationUnit);
    s('client-name', data.clientName);
    s('client-number', data.clientNumber);
    s('client-nip', data.clientNip);
    s('client-address', data.clientAddress);
    s('client-contact', data.clientContact);
    // PII: draft nie niesie kontaktów (DRAFT_PII_FIELD_KEYS) — brak klucza
    // MUSI zostawić edytor w spokoju, inaczej restore draftu skasowałby
    // kontakty wczytane z dokumentu SAVED.
    if (data.clientContacts !== undefined) {
        renderClientContactsList(data.clientContacts, {
            contactPerson: data.contactPerson,
            clientPhone: data.clientPhone,
            clientEmail: data.clientEmail,
            clientContact: data.clientContact
        });
    }
    s('invest-name', data.investName);
    s('invest-address', data.investAddress);
    s('invest-contractor', data.investContractor);
    if (document.getElementById('invest-street')) {
        ensureInvestCountryOptions();
        s('invest-street', data.investStreet ?? '');
        s('invest-postal-code', data.investPostalCode);
        s('invest-city', data.investCity);
        s('invest-country', data.investCountry || 'PL');
        s('invest-location-description', data.investLocationDescription);
        const legacyAddressNote = document.getElementById('invest-legacy-address');
        if (legacyAddressNote) {
            const hasStructuredAddress = !!(
                data.investStreet ||
                data.investPostalCode ||
                data.investCity
            );
            legacyAddressNote.textContent = hasStructuredAddress
                ? ''
                : data.investAddress
                  ? 'Adres zapisany wcześniej: ' + data.investAddress
                  : '';
            legacyAddressNote.hidden = hasStructuredAddress || !data.investAddress;
        }
        bindInvestAddressMirror();
        if (data.investContacts !== undefined || data.investContact !== undefined) {
            renderInvestContactsList(data.investContacts, { investContact: data.investContact });
        }
        syncInvestAddressMirror();
    }
    s('offer-notes', data.notes);
    s('offer-tab-notes', data.notes);
    s('offer-payment-terms', data.paymentTerms);
    s('offer-tab-payment-terms', data.paymentTerms);
    s('offer-validity', data.validity);
    s('offer-tab-validity', data.validity);
    s('transport-km', data.transportKm ?? 100);
    s('transport-rate', data.transportRate ?? 10);
}

/**
 * Przepisuje kontakty z formularza do obiektu SAVED (in-memory, bez sieci).
 * Wołane przy wejściu w edycję zamówienia i po udanym zapisie — baseline
 * ma odzwierciedlać to co widzi user, inaczej diff live-vs-SAVED wiesza się
 * na duchach (pusty edytor vs mirror, brak tablicy vs []). No-op bez edytora.
 */
function syncOrderContactsFromForm(order) {
    if (!order || typeof document === 'undefined') return;
    try {
        if (!document.getElementById('client-contacts')) return;
        // Bez mostka ESM collect zwróciłby [] i wyzerował baseline — nie ruszaj.
        if (typeof window === 'undefined' || typeof window.ClientContacts === 'undefined') return;
        const list = getClientContactsList();
        order.clientContacts = list;
        const first = Array.isArray(list) ? list[0] || {} : {};
        order.contactPerson = String(first.name || '');
        order.clientPhone = String(first.phone || '');
        order.clientEmail = String(first.email || '');
        const mirror = document.getElementById('client-contact');
        if (mirror) order.clientContact = mirror.value ?? '';
        else if (
            window.ClientContacts &&
            typeof window.ClientContacts.contactsToMirrorString === 'function'
        ) {
            try {
                order.clientContact = window.ClientContacts.contactsToMirrorString(list);
            } catch (_e2) {}
        } else order.clientContact = '';
    } catch (_e) {}
}

/**
 * Jawna piątka pól kontaktowych do PATCH zamówienia (persist, nie in-memory).
 * Czysta i testowalna: tablica tylko gdy Array, reszta stringi.
 */
function pickOrderContactFields(f) {
    const src = f && typeof f === 'object' ? f : {};
    return {
        clientContacts: Array.isArray(src.clientContacts) ? src.clientContacts : [],
        clientContact: src.clientContact || '',
        contactPerson: src.contactPerson || '',
        clientPhone: src.clientPhone || '',
        clientEmail: src.clientEmail || ''
    };
}

/**
 * Resetuje standardowe pola formularza oferty do wartości domyślnych.
 * @param {function} [numberGenerator] - opcjonalnie generuje numer oferty
 */
function clearOfferFormFields(numberGenerator) {
    const defaultOrganizationUnit = window.currentUser?.defaultOrganizationUnit || 'ASM_KLUCZBORK';
    setOfferFormFields({
        number: '',
        date: new Date().toISOString().slice(0, 10),
        organizationUnit: defaultOrganizationUnit,
        clientName: '',
        clientNumber: '',
        clientNip: '',
        clientAddress: '',
        clientContact: '',
        clientContacts: [],
        investName: '',
        investAddress: '',
        investContractor: '',
        investStreet: '',
        investPostalCode: '',
        investCity: '',
        investCountry: 'PL',
        investLocationDescription: '',
        investContact: '',
        investContacts: [],
        notes: '',
        paymentTerms: 'Do uzgodnienia lub według indywidualnych warunków handlowych.',
        validity: '7 dni',
        transportKm: 100,
        transportRate: 10
    });
    if (window.draftAutosave?.resetEmptyOfferBaseline) {
        window.draftAutosave.resetEmptyOfferBaseline();
    }
    if (typeof numberGenerator === 'function') {
        const numberInput = document.getElementById('offer-number');
        if (numberInput) {
            numberInput.value = numberGenerator();
            numberInput.dataset.numberGenerated = 'true';
        }
    }
}

/**
 * Formatuje nazwę użytkownika do wyświetlania.
 * @param {object|null} user
 * @returns {string}
 */
function buildUserDisplayName(user) {
    if (!user) return '';
    return user.firstName && user.lastName ? user.firstName + ' ' + user.lastName : user.username;
}

/**
 * Automatyczny wybór opiekuna dla nowych ofert (admin/pro).
 * @param {object} currentUser
 * @param {boolean} isNewOffer
 * @param {string|null} editingId
 * @returns {Promise<object|null>}
 */
async function assignOfferSupervisor(currentUser, isNewOffer, editingId) {
    if (!isNewOffer || !currentUser || !['admin', 'pro'].includes(currentUser.role) || editingId)
        return null;
    try {
        const resp = await fetch('/api/users-for-assignment', { headers: authHeaders() });
        const data = await resp.json();
        const users = data.data || [];
        if (users.length === 0) return null;
        const selectedUser = await showUserSelectionPopup(users, currentUser.id);
        if (selectedUser === null) return undefined;
        return selectedUser;
    } catch (e) {
        logger.error('offerCrudCommon', 'Błąd wyboru opiekuna:', e);
        return null;
    }
}

/**
 * Buduje wspolne 22+ pola dokumentu oferty.
 * @param {object} spec
 * @param {string} spec.id
 * @param {'offer'|'studnia_oferta'} spec.type
 * @param {object} spec.fields — z getOfferFormFields()
 * @param {object|null} [spec.existingDoc]
 * @param {object|null} [spec.currentUser]
 * @param {string|null} [spec.assignedUserId]
 * @param {string|null} [spec.assignedUserName]
 * @param {string|null} [spec.createdByUserId]
 * @param {string|null} [spec.createdByUserName]
 * @param {number} [spec.version] - jawny fallback gdy brak existingDoc
 * @returns {object}
 */
function buildBaseOfferDoc(spec) {
    const id = spec.id;
    const type = spec.type;
    const fields = spec.fields;
    const existingDoc = spec.existingDoc || null;
    const currentUser = spec.currentUser || null;
    const assignedUserId = spec.assignedUserId || null;
    const assignedUserName = spec.assignedUserName || null;
    const createdByUserId = spec.createdByUserId || null;
    const createdByUserName = spec.createdByUserName || null;
    // P0-D2: round-trip licznika optimistic lockingu. Bez tego backend traktuje
    // zapis jako "stary klient" (clientVersion=null) i cicho nadpisuje.
    const existingVersion = existingDoc?.version;
    const specVersion = spec.version;
    /** @type {Record<string, any>} */
    const doc = {
        id: id,
        type: type,
        userId: assignedUserId || existingDoc?.userId || (currentUser ? currentUser.id : null),
        userName: assignedUserName || existingDoc?.userName || buildUserDisplayName(currentUser),
        createdByUserId:
            createdByUserId ||
            existingDoc?.createdByUserId ||
            (currentUser ? currentUser.id : null),
        createdByUserName:
            createdByUserName ||
            existingDoc?.createdByUserName ||
            buildUserDisplayName(currentUser),
        number: fields.number,
        date: fields.date,
        organizationUnit: fields.organizationUnit || '',
        clientName: fields.clientName,
        clientNumber: fields.clientNumber,
        clientNip: fields.clientNip,
        clientAddress: fields.clientAddress,
        clientContact: fields.clientContact,
        clientContacts: fields.clientContacts || [],
        contactPerson: fields.contactPerson || '',
        clientPhone: fields.clientPhone || '',
        clientEmail: fields.clientEmail || '',
        investName: fields.investName,
        investAddress: fields.investAddress,
        investContractor: fields.investContractor,
        ...(fields.investStreet !== undefined
            ? {
                  investStreet: fields.investStreet,
                  investPostalCode: fields.investPostalCode,
                  investCity: fields.investCity,
                  investCountry: fields.investCountry,
                  investLocationDescription: fields.investLocationDescription,
                  investContact: fields.investContact,
                  investContacts: fields.investContacts || []
              }
            : {}),
        notes: fields.notes,
        paymentTerms: fields.paymentTerms,
        validity: fields.validity,
        transportKm: fields.transportKm,
        transportRate: fields.transportRate,
        createdAt: existingDoc?.createdAt || new Date().toISOString(),
        lastEditedBy: buildUserDisplayName(currentUser)
    };
    if (typeof existingVersion === 'number') doc.version = existingVersion;
    else if (typeof specVersion === 'number') doc.version = specVersion;
    return doc;
}

/**
 * P0-D2: strukturalna detekcja konfliktu wersji. Tylko status/code,
 * nigdy tekst komunikatu (teksty są kruche i zależne od języka).
 * @param {unknown} err
 * @returns {boolean}
 */
function isVersionConflict(err) {
    if (!err || typeof err !== 'object') return false;
    const e = /** @type {{status?: unknown, code?: unknown}} */ (err);
    return e.status === 409 || e.code === 'VERSION_CONFLICT';
}

/**
 * Normalizuje wartość "Data ważności" — liczba bez jednostki dostaje " dni",
 * pusta wraca do domyślnego "7 dni".
 * @param {string} val
 * @returns {string}
 */
function normalizeValidityValue(val) {
    if (!val) return '7 dni';
    const trimmed = val.trim();
    if (/^\d+$/.test(trimmed)) return trimmed + ' dni';
    return trimmed;
}

/**
 * Pole "Nr zamówienia" (osobne, read-only, poza formularzem oferty).
 * Trzymane poza get/setOfferFormFields celowo — zapis oferty nie może
 * nadpisać numeru oferty numerem zamówienia ani odwrotnie.
 * Wspólne dla rur i studni — pola mają identyczne ID.
 * @param {string} num numer zamówienia (pusty = ukryj pole)
 */
function setOrderNumberField(num) {
    const input = document.getElementById('order-number');
    if (input) input.value = num || '';
    const group = document.getElementById('order-number-group');
    if (group) group.hidden = !num;
}

/**
 * Czyści i ukrywa pole "Nr zamówienia" (wyjście z trybu zamówienia,
 * nowa oferta, ładowanie oferty).
 */
function clearOrderNumberField() {
    const input = document.getElementById('order-number');
    if (input) input.value = '';
    const group = document.getElementById('order-number-group');
    if (group) group.hidden = true;
}
/**
 * Pull-sync: kopiuje Warunki płatności i Data ważności z kroku 1
 * do pól zakładki "Oferta" (offer-tab-*). Wołane przy otwarciu zakładki
 * oraz po załadowaniu partiali (offer-tab-* powstają asynchronicznie).
 * Wspólne dla rur i studni — pola mają identyczne ID.
 */
function syncOfferTabFields() {
    const copy = (fromId, toId) => {
        const src = document.getElementById(fromId);
        const dst = document.getElementById(toId);
        if (src && dst) dst.value = src.value;
    };
    copy('offer-payment-terms', 'offer-tab-payment-terms');
    copy('offer-validity', 'offer-tab-validity');
}

document.addEventListener('DOMContentLoaded', function () {
    let _syncingValidity = false;
    let _syncingPaymentTerms = false;

    function syncValidity(src, dst) {
        if (!dst || _syncingValidity) return;
        _syncingValidity = true;
        dst.value = normalizeValidityValue(src.value);
        _syncingValidity = false;
    }

    function syncPaymentTerms(src, dst) {
        if (!dst || _syncingPaymentTerms) return;
        _syncingPaymentTerms = true;
        dst.value = src.value;
        _syncingPaymentTerms = false;
    }

    // Delegacja zdarzeń — pola zakładki "Oferta" (offer-tab-*) są wstrzykiwane
    // przez partialLoader po DOMContentLoaded, więc bezpośrednie bindowanie nie działa.
    document.addEventListener('input', function (e) {
        if (!(e.target instanceof HTMLElement)) return;
        const id = e.target.id;
        if (id === 'offer-validity' || id === 'offer-tab-validity') {
            syncValidity(
                e.target,
                document.getElementById(
                    id === 'offer-validity' ? 'offer-tab-validity' : 'offer-validity'
                )
            );
        } else if (id === 'offer-payment-terms' || id === 'offer-tab-payment-terms') {
            syncPaymentTerms(
                e.target,
                document.getElementById(
                    id === 'offer-payment-terms' ? 'offer-tab-payment-terms' : 'offer-payment-terms'
                )
            );
        }
    });

    document.addEventListener(
        'blur',
        function (e) {
            if (!(e.target instanceof HTMLInputElement)) return;
            const id = e.target.id;
            if (id === 'offer-validity' || id === 'offer-tab-validity') {
                e.target.value = normalizeValidityValue(e.target.value);
            }
        },
        true
    );
});

// Re-pull po załadowaniu partiali — pokrywa przypadek, gdy zakładka Oferta
// została otwarta zanim offer-tab-* powstały w DOM (partialLoader race).
// Dociąga też pole Nr zamówienia, gdy wejście w tryb zamówienia (?order=)
// nastąpiło przed wstrzyknięciem partiali kroku 1.
document.addEventListener('partials:loaded', function () {
    // Edytor osób do kontaktu w kroku 1 (gdy partial wstrzyknięty).
    // Guard: nie nadpisuj wierszy wczytanych z oferty (partials race).
    try {
        const box = document.getElementById('client-contacts');
        if (box && box.querySelector('[data-cc-row]')) return;
        renderClientContactsList(null, null);
    } catch (_e) {
        // pasywnie — edytor dociągnie się przy wypełnieniu formularza
    }
    syncOfferTabFields();
    try {
        let num = null;
        if (typeof getCurrentOfferOrder === 'function') {
            const o = getCurrentOfferOrder();
            if (o) num = o.orderNumber || null;
        } else if (typeof getCurrentRuryOrder === 'function') {
            const ro = getCurrentRuryOrder();
            if (ro) num = ro.orderNumber || null;
        }
        if (num) setOrderNumberField(num);
    } catch (_e) {
        // pasywnie — pole dociągnie się przy następnym renderze
    }
});

window.setOrderNumberField = setOrderNumberField;
window.clearOrderNumberField = clearOrderNumberField;

window.getOfferFormFields = getOfferFormFields;
window.setOfferFormFields = setOfferFormFields;
window.clearOfferFormFields = clearOfferFormFields;
window.buildUserDisplayName = buildUserDisplayName;
window.assignOfferSupervisor = assignOfferSupervisor;
window.buildBaseOfferDoc = buildBaseOfferDoc;
window.isVersionConflict = isVersionConflict;
window.normalizeValidityValue = normalizeValidityValue;
window.syncOfferTabFields = syncOfferTabFields;
window.syncOrderContactsFromForm = syncOrderContactsFromForm;
window.pickOrderContactFields = pickOrderContactFields;
