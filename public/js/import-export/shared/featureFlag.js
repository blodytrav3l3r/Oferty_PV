window.ImportExportFeatureFlag = {
    _cache: null,
    async isEnabled() {
        if (this._cache !== null) return this._cache;
        try {
            const opts = { credentials: 'include' };
            if (typeof authHeaders === 'function') {
                opts.headers = authHeaders();
            } else if (typeof window.getAuthToken === 'function') {
                const t = window.getAuthToken();
                if (t) opts.headers = { 'X-Auth-Token': t };
            }
            const r = await fetch('/api/feature-flags', opts);
            const j = await r.json();
            this._cache = !!j.import_export_enabled;
        } catch {
            this._cache = false;
        }
        return this._cache;
    },
    invalidate() {
        this._cache = null;
    }
};
