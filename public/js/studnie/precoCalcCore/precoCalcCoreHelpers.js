// @ts-check
/* ===== PRECO HELPER FUNCTIONS ===== */

var _precoGlobal = typeof window !== 'undefined' ? window : global;

function _findPrecoGroup(grupy, dnRury) {
    var bestMatchKey = null;
    var minDiff = Infinity;
    for (var key in grupy) {
        if (!Object.prototype.hasOwnProperty.call(grupy, key)) continue;
        var parts = key.split('-').map(Number);
        if (parts.length === 2) {
            var min = parts[0];
            var max = parts[1];
            if (dnRury >= min && dnRury <= max) {
                return grupy[key];
            }
            if (min > dnRury && min - dnRury < minDiff) {
                minDiff = min - dnRury;
                bestMatchKey = key;
            }
        } else if (parts.length === 1) {
            var val = parts[0];
            if (val === dnRury) return grupy[key];
            if (val > dnRury && val - dnRury < minDiff) {
                minDiff = val - dnRury;
                bestMatchKey = key;
            }
        }
    }
    if (bestMatchKey) {
        return grupy[bestMatchKey];
    }
    return 0;
}

function _findPrecoRange(table, value, dnRury) {
    if (!table || table.length === 0 || value == null || value === '') return 0;
    var numVal = Math.abs(parseFloat(value));
    if (isNaN(numVal) || numVal === 0) return 0;
    var maxRow = table[0];
    for (var i = 0; i < table.length; i++) {
        var row = table[i];
        if (numVal >= row.min && numVal <= row.max) {
            return _findPrecoGroup(row.grupy, dnRury);
        }
        if (row.max > maxRow.max) {
            maxRow = row;
        }
    }
    if (numVal > maxRow.max) {
        return _findPrecoGroup(maxRow.grupy, dnRury);
    }
    return 0;
}

function mergeOverlappingRanges(ranges) {
    if (!ranges || ranges.length === 0) return [];
    var sorted = ranges.slice().sort(function (a, b) {
        return a.bottom - b.bottom;
    });
    var merged = [{ bottom: sorted[0].bottom, top: sorted[0].top }];
    for (var i = 1; i < sorted.length; i++) {
        var current = merged[merged.length - 1];
        var next = sorted[i];
        if (next.bottom < current.top) {
            current.top = Math.max(current.top, next.top);
        } else {
            merged.push({ bottom: next.bottom, top: next.top });
        }
    }
    return merged;
}

function ensureDisplayIndices(przejscia) {
    if (!przejscia || przejscia.length === 0) return;
    var sorted = przejscia.slice().sort(function (a, b) {
        return (parseFloat(a.angle) || 0) - (parseFloat(b.angle) || 0);
    });
    var currentIdx = 0;
    var prevAngle = null;
    for (var i = 0; i < sorted.length; i++) {
        var p = sorted[i];
        var angle = parseFloat(p.angle) || 0;
        if (prevAngle !== null && angle !== prevAngle) {
            currentIdx++;
        }
        p.displayIndex = currentIdx;
        prevAngle = angle;
    }
}

_precoGlobal._findPrecoGroup = _findPrecoGroup;
_precoGlobal._findPrecoRange = _findPrecoRange;
_precoGlobal.mergeOverlappingRanges = mergeOverlappingRanges;
_precoGlobal.ensureDisplayIndices = ensureDisplayIndices;
