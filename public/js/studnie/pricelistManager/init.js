/* ===== INICJALIZACJA ===== */
document.addEventListener('DOMContentLoaded', async () => {
    if (window.__STUDNIE_APP_ORCHESTRATOR__) {
        return;
    }

    try {
        const authRes = await fetch('/api/auth/me', { headers: authHeaders() });
        const authData = await authRes.json();
        if (!authData.user) {
            window.location.href = 'index.html';
            return;
        }
        currentUser = authData.user;
    } catch {
        window.location.href = 'index.html';
        return;
    }

    const userEl = document.getElementById('header-username');
    const roleEl = document.getElementById('header-role-badge');
    if (userEl)
        userEl.textContent = currentUser.firstName
            ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim()
            : currentUser.username;
    if (roleEl) {
        roleEl.textContent = currentUser.role;
        roleEl.classList.add(currentUser.role === 'admin' ? 'role-admin' : 'role-user');
    }

    document.querySelectorAll('.nav-btn').forEach((/** @type {HTMLElement} */ btn) => {
        btn.addEventListener('click', () => showSection(btn.dataset.section));
    });

    document.getElementById('offer-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('offer-number').value = generateOfferNumberStudnie();

    wizardConfirmedParams = new Set();
    goToWizardStep(1);

    try {
        studnieProducts = await loadStudnieProducts();
        recalculatePEHDInternal(pehdPricePerM2);

        if (!studnieProducts.some((p) => p.componentType === 'kineta')) {
            logger.warn('pricelistManager', '[Studnie] Brak kinet w cenniku');
        }

        wells = [];
        wellCounter = 0;
        currentWellIndex = 0;
        offerDefaultZakonczenie = null;
        offerDefaultRedukcja = false;
        offerDefaultRedukcjaMinH = 2500;
        offerDefaultRedukcjaZak = null;

        refreshAll();

        const urlParams = new URLSearchParams(window.location.search);
        const tab = urlParams.get('tab');
        const orderParam = urlParams.get('order');

        offersStudnie = await loadOffersStudnie();
        ordersStudnie = await loadOrdersStudnie();
        clientsDb = await loadClientsDb();
        renderSavedOffersStudnie();

        if (orderParam) {
            await enterOrderEditMode(orderParam);
        } else if (tab) {
            showSection(tab);
        }

        if (!orderEditMode) {
            document.getElementById('offer-number').value = generateOfferNumberStudnie();
        }
    } catch (err) {
        logger.error('pricelistManager', 'Błąd podczas inicjalizacji danych:', err);
        showToast('Wystąpił błąd podczas ładowania danych. Nawigacja jest dostępna.', 'error');
        if (!orderEditMode) {
            document.getElementById('offer-number').value = generateOfferNumberStudnie();
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    document
        .getElementById('studnie-pricelist-search')
        ?.addEventListener('input', renderStudniePriceList);
});

async function fixIncompleteProducts() {
    let changed = false;
    studnieProducts.forEach((p) => {
        if (p.magazynKLB === undefined) {
            p.magazynKLB = 1;
            changed = true;
        }
        if (p.magazynWL === undefined) {
            p.magazynWL = 1;
            changed = true;
        }
        if (p.active === undefined) {
            p.active = 1;
            changed = true;
        }

        const n = (p.name || '').toUpperCase();
        const cat = (p.category || '').toUpperCase();

        if (!p.componentType || p.componentType === 'krag') {
            let newType = p.componentType || 'krag';
            if (n.includes('REDUKCYJNA')) newType = 'plyta_redukcyjna';
            else if (n.includes('DENNICA')) newType = 'dennica';
            else if (n.includes('KONUS') || n.includes('STOŻEK')) newType = 'konus';
            else if (n.includes('PŁYTA DIN') || n.includes('NAKR')) newType = 'plyta_din';
            else if (n.includes('NAJAZDOWA')) newType = 'plyta_najazdowa';
            else if (n.includes('ZAMYKAJĄCA')) newType = 'plyta_zamykajaca';
            else if (n.includes('ODCIĄŻAJĄCY')) newType = 'pierscien_odciazajacy';
            else if (n.includes('USZCZELKA')) newType = 'uszczelka';
            else if (n.includes('WŁAZ')) newType = 'wlaz';
            else if (n.includes('AVR')) newType = 'avr';

            if (newType !== p.componentType) {
                p.componentType = newType;
                changed = true;
            }
        }

        if (!p.dn || p.dn === null) {
            const dnMatch = (cat + ' ' + n).match(/DN(\d+)/i);
            if (dnMatch) {
                p.dn = parseInt(dnMatch[1]);
                changed = true;
            } else if (n.includes('STYCZNA')) {
                p.dn = 'styczna';
                changed = true;
            }
        }
    });

    if (changed) {
        await saveStudnieProducts(studnieProducts);
        logger.info(
            'pricelistManager',
            'Zastosowano automatyczne poprawki metadanych do produktów studni'
        );
    }
}

if (typeof studnieProducts !== 'undefined' && !window.__STUDNIE_APP_ORCHESTRATOR__) {
    setTimeout(fixIncompleteProducts, 1000);
}
