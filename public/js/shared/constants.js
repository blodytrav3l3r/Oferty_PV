// @ts-check
(function () {
    const MAX = 24000;
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
     * Formatowanie liczby transportów do wyświetlenia
     */
    window.formatTransportCount = function (count, mode) {
        if (mode === 'fractional') {
            const s = count.toFixed(2).replace('.', ',');
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
        const lines = [];
        const partials = [];

        items.forEach(function (item) {
            const maxByWeight = Math.floor(MAX / item.weight);
            const maxByCount = item.transport || maxByWeight;
            const maxPerTransport = Math.min(maxByWeight, maxByCount);
            if (maxPerTransport <= 0) return;
            const fullTransports = Math.floor(item.quantity / maxPerTransport);
            const remainder = item.quantity % maxPerTransport;
            const dedicated = fullTransports + (remainder > 0 ? 1 : 0);
            lines.push(dedicated);
            if (remainder > 0) {
                partials.push({ weight: remainder * item.weight });
            }
        });

        if (lines.length === 0) return { totalTrips: 0, saved: 0 };

        const totalDedicated = lines.reduce(function (s, v) {
            return s + v;
        }, 0);
        let saved = 0;

        if (partials.length > 1) {
            partials.sort(function (a, b) {
                return b.weight - a.weight;
            });
            const used = new Set();
            for (let i = 0; i < partials.length; i++) {
                if (used.has(i)) continue;
                const group = [partials[i]];
                let groupWeight = partials[i].weight;
                used.add(i);
                for (let j = i + 1; j < partials.length; j++) {
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
