/**
 * Shared UI Module — wspólne komponenty interfejsu.
 * Eliminuje duplikat showToast/closeModal/toggleCard/showSection z app.js i app_studnie.js.
 */

/**
 * Wyświetla powiadomienie toast.
 * @param {string} msg - treść powiadomienia
 * @param {'success'|'error'|'info'} type - typ powiadomienia
 */
function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Zamyka modal (popup) po ID.
 * @param {string} id - ID elementu modala
 */
function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

/**
 * Toggle (zwijanie/rozwijanie) karty.
 * @param {HTMLElement} header - kliknięty nagłówek
 */
function toggleCard(header) {
    const card = header.closest('.card');
    if (!card) return;
    const body = card.querySelector('.card-body');
    if (!body) return;
    body.style.display = body.style.display === 'none' ? 'block' : 'none';
    const icon = header.querySelector('.toggle-icon');
    if (icon) icon.textContent = body.style.display === 'none' ? '▸' : '▾';
}

/**
 * Przełącza widoczną sekcję na stronie.
 * @param {string} name - nazwa sekcji
 */
function showSection(name) {
    document.querySelectorAll('.section').forEach(s => {
        s.style.display = s.id === ('section-' + name) ? 'block' : 'none';
    });
    document.querySelectorAll('.nav-link').forEach(n => {
        n.classList.toggle('active', n.getAttribute('data-section') === name);
    });
}
