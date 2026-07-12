// @ts-check
/* ===== OFERTA — Generowanie notatek ===== */

function generateOfferNotes(onlyIfEmpty = false) {
    const offerNotesField = document.getElementById('offer-tab-notes');
    if (!offerNotesField) return;

    if (onlyIfEmpty && offerNotesField.value.trim() !== '') {
        return;
    }

    let step1Notes = document.getElementById('offer-notes')?.value || '';
    const paramIndex = step1Notes.indexOf('Parametry techniczne:');
    if (paramIndex !== -1) {
        step1Notes = step1Notes.substring(0, paramIndex).trim();
    }
    const transportIndex = step1Notes.indexOf('Cena franco budowa bez rozładunku');
    if (transportIndex !== -1) {
        step1Notes = step1Notes.substring(0, transportIndex).trim();
    }

    const getActiveParamLabel = (param) => {
        const group = document.querySelector(`.param-group[data-param="${param}"]`);
        if (!group) return null;
        const btn = group.querySelector('button.param-tile.active');
        if (!btn) return null;
        let text = btn.textContent.replace(/<[^>]*>?/gm, '').trim();
        text = text.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ');
        return text;
    };

    const getParamLabel = (param, value) => {
        if (!value || value.toLowerCase() === 'brak') return null;
        const group = document.querySelector(`.param-group[data-param="${param}"]`);
        if (!group) return value;
        const btn = group.querySelector(`button.param-tile[data-val="${value}"]`);
        if (!btn) return value;
        let text = btn.textContent.replace(/<[^>]*>?/gm, '').trim();
        text = text.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ');
        return text;
    };

    const getParamSummary = (param, labelPrefix) => {
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
    };

    const getMaterialSummary = () => {
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
    };

    const getPEHDSummary = () => {
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
    };

    const getNosnoscKorpusSummary = () => {
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
    };

    const getNosnoscZwienczenieSummary = () => {
        if (!wells || wells.length === 0) {
            const klasaNosnosciZ = getActiveParamLabel('klasaNosnosci_zwienczenie');
            return klasaNosnosciZ && !klasaNosnosciZ.includes('D400')
                ? `Klasa nośności Zwieńczenie: ${klasaNosnosciZ}`
                : null;
        }
        const values = new Set();
        wells.forEach((well) => {
            if (
                well.klasaNosnosci_zwienczenie &&
                !well.klasaNosnosci_zwienczenie.includes('D400')
            ) {
                const label = getParamLabel(
                    'klasaNosnosci_zwienczenie',
                    well.klasaNosnosci_zwienczenie
                );
                if (label) values.add(label);
            }
        });
        if (values.size === 0) return null;
        return `Klasa nośności Zwieńczenie: ${Array.from(values).join(', ')}`;
    };

    const summaryParts = [];

    const matSum = getMaterialSummary();
    if (matSum) summaryParts.push(matSum);

    const betSum = getParamSummary('klasaBetonu', 'Klasa betonu');
    if (betSum) summaryParts.push(betSum);

    const pehdSum = getPEHDSummary();
    if (pehdSum) summaryParts.push(pehdSum);

    const chemSum = getParamSummary('agresjaChemiczna', 'Agresja chemiczna');
    if (chemSum) summaryParts.push(chemSum);

    const mrozSum = getParamSummary('agresjaMrozowa', 'Agresja mrozowa');
    if (mrozSum) summaryParts.push(mrozSum);

    const malWSum = getParamSummary('malowanieW', 'Malowanie wewnątrz');
    if (malWSum) summaryParts.push(malWSum);

    const malZSum = getParamSummary('malowanieZ', 'Malowanie zewnątrz');
    if (malZSum) summaryParts.push(malZSum);

    const kinSum = getParamSummary('kineta', 'Kineta');
    if (kinSum) summaryParts.push(kinSum);

    const stopSum = getParamSummary('stopnie', 'Rodzaj stopni');
    if (stopSum) summaryParts.push(stopSum);

    const uszczSum = getParamSummary('uszczelka', 'Uszczelka');
    if (uszczSum) summaryParts.push(uszczSum);

    const nosKSum = getNosnoscKorpusSummary();
    if (nosKSum) summaryParts.push(nosKSum);

    const nosZSum = getNosnoscZwienczenieSummary();
    if (nosZSum) summaryParts.push(nosZSum);

    // Zbieranie informacji o przejściach z faktycznych studni
    const przejsciaTypes = new Set();
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        wells.forEach((well) => {
            if (well.przejscia && Array.isArray(well.przejscia)) {
                well.przejscia.forEach((pr) => {
                    const prProd =
                        typeof studnieProducts !== 'undefined'
                            ? studnieProducts.find((x) => x.id === pr.productId)
                            : null;
                    if (prProd) {
                        const name = prProd.category || prProd.name || '';
                        // Omijamy wiercenia
                        if (
                            name.toLowerCase().includes('wiercenie') ||
                            name.toLowerCase().includes('insitu')
                        )
                            return;

                        // Zostawiamy tylko rodzaj, omijając typowe rozmiary i zbędne słowa
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
        const przejsciaArr = Array.from(przejsciaTypes).join(', ');
        summaryParts.push(`Przyłącza dostudzienne: ${przejsciaArr}`);
    }

    let generatedText = step1Notes ? step1Notes + '\n\n' : '';

    if (summaryParts.length > 0) {
        generatedText += 'Parametry techniczne: ' + summaryParts.join(', ') + '.';
    }

    if (generatedText) {
        generatedText += '\n';
    }
    generatedText += 'Cena franco budowa bez rozładunku przy dostawie pełnych transportów 24t.';

    offerNotesField.value = generatedText.trim();
}
