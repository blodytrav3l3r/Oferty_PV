/* ===== GENEROWANIE NOTATEK OFERTY ===== */

function getActiveParamLabel(param) {
    const group = document.querySelector(`.param-group[data-param="${param}"]`);
    if (!group) return null;
    const btn = group.querySelector('button.param-tile.active');
    if (!btn) return null;
    let text = btn.textContent.replace(/<[^>]*>?/gm, '').trim();
    text = text.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ');
    return text;
}

function getParamLabel(param, value) {
    if (!value || value.toLowerCase() === 'brak') return null;
    const group = document.querySelector(`.param-group[data-param="${param}"]`);
    if (!group) return value;
    const btn = group.querySelector(`button.param-tile[data-val="${value}"]`);
    if (!btn) return value;
    let text = btn.textContent.replace(/<[^>]*>?/gm, '').trim();
    text = text.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ');
    return text;
}

function getParamSummary(param, labelPrefix) {
    if (!wells || wells.length === 0) {
        const activeVal = getActiveParamLabel(param);
        return activeVal && activeVal.toLowerCase() !== 'brak'
            ? `${labelPrefix}: ${activeVal}`
            : null;
    }

    const values = new Set();
    wells.forEach((well) => {
        const val = well[param];
        if (val && val !== 'brak') {
            const label = getParamLabel(param, val);
            if (label && label.toLowerCase() !== 'brak') {
                values.add(label);
            }
        }
    });

    if (values.size === 0) return null;
    return `${labelPrefix}: ${Array.from(values).join(', ')}`;
}

function getMaterialSummary() {
    if (!wells || wells.length === 0) {
        const materialNadbudowy = getActiveParamLabel('nadbudowa') || 'Betonowa';
        const materialDennicy = getActiveParamLabel('dennicaMaterial') || materialNadbudowy;
        if (materialNadbudowy === materialDennicy) {
            return `Nadbudowa i Dennica: ${materialNadbudowy}`;
        } else {
            return `Nadbudowa: ${materialNadbudowy}, Dennica: ${materialDennicy}`;
        }
    }

    const nadbudowy = new Set();
    const dennice = new Set();

    wells.forEach((well) => {
        if (well.nadbudowa) {
            const label = getParamLabel('nadbudowa', well.nadbudowa);
            if (label) nadbudowy.add(label);
        }
        if (well.dennicaMaterial) {
            const label = getParamLabel('dennicaMaterial', well.dennicaMaterial);
            if (label) dennice.add(label);
        }
    });

    const nStr = Array.from(nadbudowy).filter(Boolean).join(', ') || 'Betonowa';
    const dStr = Array.from(dennice).filter(Boolean).join(', ') || nStr;

    if (nStr === dStr) {
        return `Nadbudowa i Dennica: ${nStr}`;
    } else {
        return `Nadbudowa: ${nStr}, Dennica: ${dStr}`;
    }
}

function getPEHDSummary() {
    if (!wells || wells.length === 0) {
        const wkladka = getActiveParamLabel('wkladka');
        return wkladka && wkladka.toLowerCase() !== 'brak' ? `Wkładka PEHD: ${wkladka}` : null;
    }

    const PEHDTypes = new Set();
    wells.forEach((well) => {
        if (well.wkladkaDennica && well.wkladkaDennica !== 'brak')
            PEHDTypes.add(getParamLabel('wkladka', well.wkladkaDennica));
        if (well.wkladkaNadbudowa && well.wkladkaNadbudowa !== 'brak')
            PEHDTypes.add(getParamLabel('wkladka', well.wkladkaNadbudowa));
        if (well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak')
            PEHDTypes.add(getParamLabel('wkladka', well.wkladkaZwienczenie));
    });

    if (PEHDTypes.size === 0) return null;
    return `Wkładka PEHD: ${Array.from(PEHDTypes).join(', ')}`;
}

function getNosnoscKorpusSummary() {
    if (!wells || wells.length === 0) {
        const klasaNosnosciK = getActiveParamLabel('klasaNosnosci_korpus');
        return klasaNosnosciK && !klasaNosnosciK.includes('D400')
            ? `Klasa nośności (Dennica + Nadbudowa): ${klasaNosnosciK}`
            : null;
    }
    const values = new Set();
    wells.forEach((well) => {
        if (well.klasaNosnosci_korpus && !well.klasaNosnosci_korpus.includes('D400')) {
            const label = getParamLabel('klasaNosnosci_korpus', well.klasaNosnosci_korpus);
            if (label) values.add(label);
        }
    });
    if (values.size === 0) return null;
    return `Klasa nośności (Dennica + Nadbudowa): ${Array.from(values).join(', ')}`;
}

function getNosnoscZwienczenieSummary() {
    if (!wells || wells.length === 0) {
        const klasaNosnosciZ = getActiveParamLabel('klasaNosnosci_zwienczenie');
        return klasaNosnosciZ && !klasaNosnosciZ.includes('D400')
            ? `Klasa nośności Zwieńczenie: ${klasaNosnosciZ}`
            : null;
    }
    const values = new Set();
    wells.forEach((well) => {
        if (well.klasaNosnosci_zwienczenie && !well.klasaNosnosci_zwienczenie.includes('D400')) {
            const label = getParamLabel(
                'klasaNosnosci_zwienczenie',
                well.klasaNosnosci_zwienczenie
            );
            if (label) values.add(label);
        }
    });
    if (values.size === 0) return null;
    return `Klasa nośności Zwieńczenie: ${Array.from(values).join(', ')}`;
}

function getPrzejsciaSummary() {
    const przejsciaTypes = new Set();
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        wells.forEach((well) => {
            if (well.przejscia && Array.isArray(well.przejscia)) {
                well.przejscia.forEach((pr) => {
                    const prProd =
                        typeof studnieProducts !== 'undefined'
                            ? typeof getStudnieProductById === 'function'
                                ? getStudnieProductById(pr.productId)
                                : studnieProducts.find((x) => x.id === pr.productId)
                            : null;
                    if (prProd) {
                        const name = prProd.category || prProd.name || '';
                        if (
                            name.toLowerCase().includes('wiercenie') ||
                            name.toLowerCase().includes('insitu')
                        )
                            return;

                        const type = name
                            .replace(/DN\s*\d+/i, '')
                            .replace(/fi\s*\d+/i, '')
                            .trim();
                        if (type) {
                            przejsciaTypes.add(type);
                        }
                    }
                });
            }
        });
    }

    if (przejsciaTypes.size > 0) {
        return `Przyłącza dostudzienne: ${Array.from(przejsciaTypes).join(', ')}`;
    }
    return null;
}

function getWellUwagiSummary() {
    if (typeof wells === 'undefined' || !Array.isArray(wells)) return null;
    const rows = wells
        .filter((w) => w.uwagi && String(w.uwagi).trim())
        .map((w) => `• ${w.name} (DN${w.dn}): ${String(w.uwagi).trim().replace(/\n/g, ' ')}`);
    if (rows.length === 0) return null;
    return `Uwagi do studni:\n${rows.join('\n')}`;
}

// Rdzeń wspólny w shared/offerNotesGenerator.js (TASK-045)
window.generateOfferNotes = createOfferNotesGenerator([
    getMaterialSummary,
    () => getParamSummary('klasaBetonu', 'Klasa betonu'),
    getPEHDSummary,
    () => getParamSummary('agresjaChemiczna', 'Agresja chemiczna'),
    () => getParamSummary('agresjaMrozowa', 'Agresja mrozowa'),
    () => getParamSummary('malowanieW', 'Malowanie wewnątrz'),
    () => getParamSummary('malowanieZ', 'Malowanie zewnątrz'),
    () => getParamSummary('kineta', 'Kineta'),
    () => getParamSummary('stopnie', 'Rodzaj stopni'),
    () => getParamSummary('uszczelka', 'Uszczelka'),
    getNosnoscKorpusSummary,
    getNosnoscZwienczenieSummary,
    getPrzejsciaSummary,
    getWellUwagiSummary
]);
