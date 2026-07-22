// @ts-check
/* ===== WSPÓLNE HELPERY CRUD OFERT ===== */
/* Używane przez: offerCrud.js (rury), offerSave.js i offerManager.js (studnie) */

/**
 * Zbiera standardowe pola formularza oferty.
 * @returns {{number:string,date:string,clientName:string,clientNip:string,clientAddress:string,clientContact:string,investName:string,investAddress:string,investContractor:string,notes:string,paymentTerms:string,validity:string,transportKm:number,transportRate:number}}
 */
function getOfferFormFields() {
    const g = (id) => (document.getElementById(id)?.value ?? '').trim();
    return {
        number: g('offer-number'),
        date: document.getElementById('offer-date')?.value || '',
        clientName: g('client-name'),
        clientNip: g('client-nip'),
        clientAddress: g('client-address'),
        clientContact: g('client-contact'),
        investName: g('invest-name'),
        investAddress: g('invest-address'),
        investContractor: g('invest-contractor'),
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
 * @param {{number?:string,date?:string,clientName?:string,clientNip?:string,clientAddress?:string,clientContact?:string,investName?:string,investAddress?:string,investContractor?:string,notes?:string,paymentTerms?:string,validity?:string,transportKm?:number,transportRate?:number}} data
 */
function setOfferFormFields(data) {
    const s = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val ?? '';
    };
    s('offer-number', data.number);
    s('offer-date', data.date || new Date().toISOString().slice(0, 10));
    s('client-name', data.clientName);
    s('client-nip', data.clientNip);
    s('client-address', data.clientAddress);
    s('client-contact', data.clientContact);
    s('invest-name', data.investName);
    s('invest-address', data.investAddress);
    s('invest-contractor', data.investContractor);
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
 * Resetuje standardowe pola formularza oferty do wartości domyślnych.
 * @param {function} [numberGenerator] - opcjonalnie generuje numer oferty
 */
function clearOfferFormFields(numberGenerator) {
    setOfferFormFields({
        number: typeof numberGenerator === 'function' ? numberGenerator() : '',
        date: new Date().toISOString().slice(0, 10),
        clientName: '',
        clientNip: '',
        clientAddress: '',
        clientContact: '',
        investName: '',
        investAddress: '',
        investContractor: '',
        notes: '',
        paymentTerms: 'Do uzgodnienia lub według indywidualnych warunków handlowych.',
        validity: '7 dni',
        transportKm: 100,
        transportRate: 10
    });
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
 * @returns {object}
 */
function buildBaseOfferDoc(spec) {
    var id = spec.id;
    var type = spec.type;
    var fields = spec.fields;
    var existingDoc = spec.existingDoc || null;
    var currentUser = spec.currentUser || null;
    var assignedUserId = spec.assignedUserId || null;
    var assignedUserName = spec.assignedUserName || null;
    var createdByUserId = spec.createdByUserId || null;
    var createdByUserName = spec.createdByUserName || null;
    return {
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
        clientName: fields.clientName,
        clientNip: fields.clientNip,
        clientAddress: fields.clientAddress,
        clientContact: fields.clientContact,
        investName: fields.investName,
        investAddress: fields.investAddress,
        investContractor: fields.investContractor,
        notes: fields.notes,
        paymentTerms: fields.paymentTerms,
        validity: fields.validity,
        transportKm: fields.transportKm,
        transportRate: fields.transportRate,
        createdAt: existingDoc?.createdAt || new Date().toISOString(),
        lastEditedBy: buildUserDisplayName(currentUser)
    };
}

window.getOfferFormFields = getOfferFormFields;
window.setOfferFormFields = setOfferFormFields;
window.clearOfferFormFields = clearOfferFormFields;
window.buildUserDisplayName = buildUserDisplayName;
window.assignOfferSupervisor = assignOfferSupervisor;
window.buildBaseOfferDoc = buildBaseOfferDoc;
