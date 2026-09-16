// @ts-nocheck
/**
 * shareService.js — obsługa API udostępniania dokumentów.
 * Używa StorageService.getHeaders() dla auth.
 */
class ShareService {
    // Wariant A: share API wyłącznie na cookie httpOnly. Bez tokenu w JS,
    // bez fallbacków localStorage/document.cookie (martwe dla httpOnly).
    getHeaders() {
        return { 'Content-Type': 'application/json' };
    }

    // Każdy request dokłada credentials — sesję niesie cookie.
    _opts(extra) {
        return Object.assign(
            { headers: this.getHeaders(), credentials: 'same-origin' },
            extra || {}
        );
    }

    async getShareableUsers() {
        const res = await fetch('/api/users/shareable', this._opts());
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Błąd pobierania użytkowników');
        return data.data || [];
    }

    async getShares(documentType, documentId) {
        const url = `/api/shares?documentType=${encodeURIComponent(documentType)}&documentId=${encodeURIComponent(documentId)}`;
        const res = await fetch(url, this._opts());
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Błąd pobierania udostępnień');
        return data;
    }

    async createShares(documentType, documentId, userIds) {
        const res = await fetch(
            '/api/shares',
            this._opts({
                method: 'POST',
                body: JSON.stringify({ documentType, documentId, userIds })
            })
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Błąd udostępniania');
        return data;
    }

    async revokeShare(shareId) {
        const res = await fetch(
            `/api/shares/${encodeURIComponent(shareId)}`,
            this._opts({ method: 'DELETE' })
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Błąd cofania udostępnienia');
        return data;
    }

    async revokeByUsers(documentType, documentId, userIds) {
        const res = await fetch(
            '/api/shares/revoke',
            this._opts({
                method: 'POST',
                body: JSON.stringify({ documentType, documentId, userIds })
            })
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Błąd cofania udostępnień');
        return data;
    }
}

export const shareService = new ShareService();
if (typeof window !== 'undefined') window.shareService = shareService;
export default shareService;
