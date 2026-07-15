// @ts-check
/* ===== ZARZĄDZANIE OPIEKUNEM OFERTY (STUDNIE) ===== */

async function changeOfferUser() {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'pro')) {
        showToast('Brak uprawnień do zmiany opiekuna', 'error');
        return;
    }
    try {
        const usersResp = await fetch('/api/users-for-assignment', { headers: authHeaders() });
        const usersData = await usersResp.json();
        const allUsers = usersData.data || [];

        if (allUsers.length > 0) {
            const currentId = editingOfferAssignedUserId || currentUser.id;
            const selectedUser = await showUserSelectionPopup(allUsers, currentId);
            if (selectedUser !== null) {
                editingOfferAssignedUserId = selectedUser.id;
                editingOfferAssignedUserName =
                    selectedUser.firstName && selectedUser.lastName
                        ? `${selectedUser.firstName} ${selectedUser.lastName}`
                        : selectedUser.displayName || selectedUser.username;
                showToast(`Opiekun zmieniony na: ${editingOfferAssignedUserName}`, 'success');

                const btnChangeUser = document.getElementById('btn-change-offer-user');
                if (btnChangeUser)
                    btnChangeUser.innerHTML =
                        '<i data-lucide="user"></i> Opiekun: ' +
                        escapeHtml(editingOfferAssignedUserName);

                if (editingOfferIdStudnie) {
                    saveOfferStudnie();

                    const oId = normalizeId(editingOfferIdStudnie);
                    const linkedOrder = ordersStudnie
                        ? ordersStudnie.find((o) => normalizeId(o.offerId) === oId)
                        : null;
                    if (linkedOrder) {
                        linkedOrder.userId = editingOfferAssignedUserId;
                        linkedOrder.userName = editingOfferAssignedUserName;
                        fetch(`/api/orders-studnie/${linkedOrder.id}`, {
                            method: 'PATCH',
                            headers: authHeaders(),
                            body: JSON.stringify({
                                userId: linkedOrder.userId,
                                userName: linkedOrder.userName
                            })
                        }).catch((e) =>
                            logger.error(
                                'offerManager',
                                'Błąd aktualizacji opiekuna w zamówieniu:',
                                e
                            )
                        );
                    }
                }
            }
        }
    } catch (e) {
        logger.error('offerManager', 'Błąd pobierania użytkowników:', e);
        showToast('Błąd pobierania listy użytkowników', 'error');
    }
}

async function changeOfferUserFromListStudnie(offerId) {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'pro')) {
        showToast('Brak uprawnień do zmiany opiekuna', 'error');
        return;
    }
    const offer = offersStudnie.find((o) => o.id === offerId);
    if (!offer) {
        showToast('Nie znaleziono oferty', 'error');
        return;
    }

    try {
        const usersResp = await fetch('/api/users-for-assignment', { headers: authHeaders() });
        const usersData = await usersResp.json();
        const allUsers = usersData.data || [];

        if (allUsers.length > 0) {
            const currentId = offer.userId || currentUser.id;
            const selectedUser = await showUserSelectionPopup(allUsers, currentId);
            if (selectedUser !== null) {
                offer.userId = selectedUser.id;
                offer.userName =
                    selectedUser.firstName && selectedUser.lastName
                        ? `${selectedUser.firstName} ${selectedUser.lastName}`
                        : selectedUser.displayName || selectedUser.username;

                const { storageService } = await import('../shared/StorageService.js');
                await storageService.saveOffer(offer);

                const oId = normalizeId(offerId);
                const linkedOrder = ordersStudnie
                    ? ordersStudnie.find((o) => normalizeId(o.offerId) === oId)
                    : null;
                if (linkedOrder) {
                    linkedOrder.userId = offer.userId;
                    linkedOrder.userName = offer.userName;
                    fetch(`/api/orders-studnie/${linkedOrder.id}`, {
                        method: 'PATCH',
                        headers: authHeaders(),
                        body: JSON.stringify({
                            userId: linkedOrder.userId,
                            userName: linkedOrder.userName
                        })
                    }).catch((e) =>
                        logger.error('offerManager', 'Błąd aktualizacji opiekuna w zamówieniu:', e)
                    );
                }

                showToast(`Opiekun zmieniony na: ${offer.userName}`, 'success');
                renderSavedOffersStudnie();

                if (editingOfferIdStudnie === offerId) {
                    editingOfferAssignedUserId = offer.userId;
                    editingOfferAssignedUserName = offer.userName;
                    const btnChangeUser = document.getElementById('btn-change-offer-user');
                    if (btnChangeUser)
                        btnChangeUser.innerHTML =
                            '<i data-lucide="user"></i> Opiekun: ' + escapeHtml(offer.userName);
                }
            }
        }
    } catch (e) {
        logger.error('offerManager', 'Błąd zmiany opiekuna z listy:', e);
        showToast('Wystąpił błąd przy zmianie opiekuna', 'error');
    }
}
