// @ts-nocheck
/**
 * shareService.js — obsługa API udostępniania dokumentów.
 * Używa StorageService.getHeaders() dla auth.
 */
class ShareService {
    getHeaders() {
        if (
            typeof window !== 'undefined' &&
            window.storageService &&
            typeof window.storageService.getHeaders === 'function'
        ) {
            return window.storageService.getHeaders();
        }
        const h = { 'Content-Type': 'application/json' };
        let token = null;
        if (typeof window !== 'undefined' && typeof window.getAuthToken === 'function')
            token = window.getAuthToken();
        if (!token) {
            const m = document.cookie.match(/(?:^|;\s*)authToken=([^;]*)/);
            if (m && m[1]) token = m[1];
            else if (typeof localStorage !== 'undefined') token = localStorage.getItem('authToken');
        }
        if (token) h['X-Auth-Token'] = token;
        return h;
    }

    async getShareableUsers() {
        const res = await fetch('/api/users/shareable', { headers: this.getHeaders() });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Błąd pobierania użytkowników');
        return data.data || [];
    }

    async getShares(documentType, documentId) {
        const url = `/api/shares?documentType=${encodeURIComponent(documentType)}&documentId=${encodeURIComponent(documentId)}`;
        const res = await fetch(url, { headers: this.getHeaders() });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Błąd pobierania udostępnień');
        return data;
    }

    async createShares(documentType, documentId, userIds) {
        const res = await fetch('/api/shares', {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ documentType, documentId, userIds })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Błąd udostępniania');
        return data;
    }

    async revokeShare(shareId) {
        const res = await fetch(`/api/shares/${encodeURIComponent(shareId)}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Błąd cofania udostępnienia');
        return data;
    }

    async revokeByUsers(documentType, documentId, userIds) {
        const res = await fetch('/api/shares/revoke', {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ documentType, documentId, userIds })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Błąd cofania udostępnień');
        return data;
    }
}

export const shareService = new ShareService();
if (typeof window !== 'undefined') window.shareService = shareService;
export default shareService;
