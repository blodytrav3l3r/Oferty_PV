(function () {
    var MAX = 24000;
    window.MAX_TRANSPORT_WEIGHT = MAX;
    window.FLOW_TYPES = Object.freeze({
        WYLOT: 'wylot',
        WLOT: 'wlot',
        DOLOT: 'dolot'
    });

    /**
     * Liczbę transportów: 'full' = ceil (pełne), 'fractional' = ułamkowe
     */
    window.calcTransportCount = function (weight, mode) {
        if (weight <= 0) return 0;
        if (mode === 'fractional') {
            return Math.round((weight / MAX) * 1000) / 1000;
        }
        return Math.ceil(weight / MAX);
    };

    /**
     * Koszt transportu na podstawie wagi, km, stawki i trybu
     */
    window.calcTransportCost = function (weight, km, rate, mode) {
        var count = window.calcTransportCount(weight, mode);
        return count * km * rate;
    };

    /**
     * Formatowanie liczby transportów do wyświetlenia
     */
    window.formatTransportCount = function (count, mode) {
        if (mode === 'fractional') {
            var s = count.toFixed(2).replace('.', ',');
            return s;
        }
        return String(Math.ceil(count));
    };

    /**
     * Liczy liczbę kursów transportu z bin-packing konsolidacją.
     * @param {Array<{weight:number, transport:number, quantity:number}>} items
     * @returns {{ totalTrips: number, saved: number }}
     */
    window.calculateTransportTrips = function (items) {
        var lines = [];
        var partials = [];

        items.forEach(function (item) {
            var maxByWeight = Math.floor(MAX / item.weight);
            var maxByCount = item.transport || maxByWeight;
            var maxPerTransport = Math.min(maxByWeight, maxByCount);
            if (maxPerTransport <= 0) return;
            var fullTransports = Math.floor(item.quantity / maxPerTransport);
            var remainder = item.quantity % maxPerTransport;
            var dedicated = fullTransports + (remainder > 0 ? 1 : 0);
            lines.push(dedicated);
            if (remainder > 0) {
                partials.push({ weight: remainder * item.weight });
            }
        });

        if (lines.length === 0) return { totalTrips: 0, saved: 0 };

        var totalDedicated = lines.reduce(function (s, v) { return s + v; }, 0);
        var saved = 0;

        if (partials.length > 1) {
            partials.sort(function (a, b) { return b.weight - a.weight; });
            var used = new Set();
            for (var i = 0; i < partials.length; i++) {
                if (used.has(i)) continue;
                var group = [partials[i]];
                var groupWeight = partials[i].weight;
                used.add(i);
                for (var j = i + 1; j < partials.length; j++) {
                    if (used.has(j)) continue;
                    if (groupWeight + partials[j].weight <= MAX) {
                        group.push(partials[j]);
                        groupWeight += partials[j].weight;
                        used.add(j);
                    }
                }
                if (group.length > 1) saved += group.length - 1;
            }
        }

        return { totalTrips: Math.max(0, totalDedicated - saved), saved: saved };
    };
})();
