// @ts-check
// Moduł historii/audytu dla PV Sales UI

import {
    auditGetContextLabel,
    auditGetActionMeta,
    auditGetFieldLabel,
    auditFormatValue,
    auditGetSnapshotTitle,
    auditGetSnapshotSummary,
    auditGetBusinessChanges,
    auditRenderEntry,
    auditShowHistory,
    auditLoadMore,
    auditRestoreVersion,
    auditShowSnapshotModal,
    auditViewSnapshot
} from './pvSalesAudit.js';

export default {
    getAuditContextLabel(type) {
        return auditGetContextLabel(this, type);
    },
    getAuditActionMeta(log) {
        return auditGetActionMeta(log);
    },
    getAuditFieldLabel(key) {
        return auditGetFieldLabel(key);
    },
    formatAuditValue(value) {
        return auditFormatValue(this, value);
    },
    getAuditSnapshotTitle(data, type) {
        return auditGetSnapshotTitle(this, data, type);
    },
    getAuditSnapshotSummary(data, type) {
        return auditGetSnapshotSummary(this, data, type);
    },
    getBusinessChanges(log) {
        return auditGetBusinessChanges(this, log);
    },
    renderAuditEntry(log, id, type) {
        return auditRenderEntry(this, log, id, type);
    },
    async showOfferHistoryUnified(id, type = 'studnia_oferta') {
        return auditShowHistory(this, id, type);
    },
    async loadMoreAuditLogs(entityType, entityId, limit) {
        return auditLoadMore(this, entityType, entityId, limit);
    },
    async restoreOfferVersionUnified(offerId, logId, type) {
        return auditRestoreVersion(this, offerId, logId, type);
    },
    showAuditSnapshotModal(data, type) {
        return auditShowSnapshotModal(this, data, type);
    },
    async viewHistorySnapshotUnified(id, logId, type) {
        return auditViewSnapshot(this, id, logId, type);
    }
};
