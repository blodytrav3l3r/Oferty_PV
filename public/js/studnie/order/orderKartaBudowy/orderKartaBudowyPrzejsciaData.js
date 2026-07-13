// @ts-check
/* ===== KARTA BUDOWY — Przejścia (warstwa danych) ===== */

let _customPrzejscieRows = [];
let _offerPrzejscieRows = [];
let _przejsciaInitialized = false;

function buildOfferPrzejsciaTypes() {
    const usedProductIds = new Set();
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        wells.forEach((w) => {
            if (w.przejscia && Array.isArray(w.przejscia)) {
                w.przejscia.forEach((pr) => {
                    if (pr.productId) {
                        usedProductIds.add(pr.productId);
                    }
                });
            }
        });
    }

    const przejsciaProducts = studnieProducts.filter(
        (p) => p.componentType === 'przejscie' && p.active !== 0 && usedProductIds.has(p.id)
    );
    const typeMap = new Map();
    const stringDnMap = new Map();

    przejsciaProducts.forEach((p) => {
        const cat = p.category;
        if (!cat) return;

        if (typeof p.dn === 'string' && p.dn.includes('/')) {
            if (!stringDnMap.has(cat)) {
                stringDnMap.set(cat, { dnStrings: [] });
            }
            stringDnMap.get(cat).dnStrings.push(p.dn);
        } else {
            const dn = parseFloat(p.dn) || 0;
            if (!typeMap.has(cat)) {
                typeMap.set(cat, { dnMin: dn, dnMax: dn });
            } else {
                const entry = typeMap.get(cat);
                if (dn < entry.dnMin) entry.dnMin = dn;
                if (dn > entry.dnMax) entry.dnMax = dn;
            }
        }
    });

    const result = [];
    typeMap.forEach((val, key) => {
        result.push({
            rodzaj: key,
            dnOd: val.dnMin,
            dnDo: val.dnMax,
            ilosc: 1,
            uwagi: '',
            czyPrzejscie: 'TAK',
            source: 'offer'
        });
    });
    stringDnMap.forEach((val, key) => {
        val.dnStrings = [...val.dnStrings].sort((a, b) => {
            const aFirst = parseFloat(a.split('/')[0]) || 0;
            const bFirst = parseFloat(b.split('/')[0]) || 0;
            return aFirst - bFirst;
        });
        const uniqueDns = [...new Set(val.dnStrings)];
        uniqueDns.forEach((dn) => {
            result.push({
                rodzaj: key,
                dnOd: dn,
                dnDo: dn,
                ilosc: 1,
                uwagi: '',
                czyPrzejscie: 'TAK',
                source: 'offer'
            });
        });
    });
    return result.sort((a, b) => a.rodzaj.localeCompare(b.rodzaj));
}

function updatePrzejscieDnOptions(prefix, category) {
    const dns = new Set();
    const dnsStr = new Set();
    let hasStringDn = false;
    if (typeof studnieProducts !== 'undefined') {
        studnieProducts.forEach((p) => {
            if (
                p.componentType === 'przejscie' &&
                p.active !== 0 &&
                (!category || category === 'Inne' || p.category === category)
            ) {
                if (typeof p.dn === 'string' && p.dn.includes('/')) {
                    hasStringDn = true;
                    dnsStr.add(p.dn);
                    dns.add(parseFloat(p.dn.split('/')[1]) || parseFloat(p.dn.split('/')[0]) || 0);
                } else if (p.dn) {
                    dns.add(parseFloat(p.dn) || 0);
                }
            }
        });
    }

    if (hasStringDn && category && category !== 'Inne') {
        const sortedStr = Array.from(dnsStr).sort((a, b) => {
            const aFirst = parseFloat(a.split('/')[0]) || 0;
            const bFirst = parseFloat(b.split('/')[0]) || 0;
            return aFirst - bFirst;
        });
        const minStr = sortedStr[0] || '';
        const maxStr = sortedStr[sortedStr.length - 1] || minStr;

        ['dnod', 'dndo'].forEach((type) => {
            const select = document.getElementById(`${prefix}-${type}-select`);
            const input = document.getElementById(`${prefix}-${type}`);
            if (!select || !input) return;
            const val = type === 'dndo' ? maxStr : minStr;
            input.type = 'text';
            input.value = val;
            input.style.display = 'block';
            input.readOnly = true;
            input.style.opacity = '0.7';
            input.style.cursor = 'default';
            select.style.display = 'none';
        });
        return;
    }

    const dnOptions = Array.from(dns)
        .filter((d) => !isNaN(d) && d > 0)
        .sort((a, b) => a - b);

    ['dnod', 'dndo'].forEach((type) => {
        const select = document.getElementById(`${prefix}-${type}-select`);
        const input = document.getElementById(`${prefix}-${type}`);
        if (!select || !input) return;

        const currVal = input.value;
        const forceInne = category === 'Inne';
        const isCurrInne = forceInne || (currVal && !dnOptions.includes(parseFloat(currVal)));

        let html = `<option value="" ${!currVal && !forceInne ? 'selected' : ''}>â€”</option>`;
        html += dnOptions
            .map(
                (d) =>
                    `<option value="${d}" ${!forceInne && parseFloat(currVal) === d ? 'selected' : ''}>${d}</option>`
            )
            .join('');
        html += `<option value="Inne" ${isCurrInne ? 'selected' : ''}>Inne</option>`;

        select.innerHTML = html;
        if (isCurrInne) {
            select.value = 'Inne';
            input.style.display = 'block';
        } else if (currVal && dnOptions.includes(parseFloat(currVal))) {
            select.value = String(parseFloat(currVal));
            input.style.display = 'none';
        } else {
            select.value = '';
            input.value = '';
            input.style.display = 'none';
        }
    });
}

function _syncCustomRowsFromDOM() {
    const rows = document.querySelectorAll('tr[data-psz-source]');
    rows.forEach((tr) => {
        const source = tr.dataset.pszSource;
        const idx = parseInt(tr.dataset.pszIdx);
        const prefix = `step4-psz-${source}-${idx}`;

        const rodzajEl = document.getElementById(`${prefix}-rodzaj`);
        const dnOdEl = document.getElementById(`${prefix}-dnod`);
        const dnDoEl = document.getElementById(`${prefix}-dndo`);
        const iloscEl = document.getElementById(`${prefix}-ilosc`);
        const uwagiEl = document.getElementById(`${prefix}-uwagi`);
        const czyEl = document.getElementById(`${prefix}-czy`);

        if (!rodzajEl) return;

        const data = {
            rodzaj: rodzajEl.value.trim(),
            dnOd:
                dnOdEl && dnOdEl.value
                    ? dnOdEl.value.includes('/')
                        ? dnOdEl.value
                        : parseFloat(dnOdEl.value)
                    : '',
            dnDo:
                dnDoEl && dnDoEl.value
                    ? dnDoEl.value.includes('/')
                        ? dnDoEl.value
                        : parseFloat(dnDoEl.value)
                    : '',
            ilosc: iloscEl ? parseInt(iloscEl.value) || 1 : 1,
            uwagi: uwagiEl ? uwagiEl.value.trim() : '',
            czyPrzejscie: czyEl ? czyEl.value : 'TAK',
            source: source
        };

        if (source === 'custom') {
            _customPrzejscieRows[idx] = data;
        } else if (source === 'offer') {
            _offerPrzejscieRows[idx] = data;
        }
    });
}

function collectPrzejsciaDetailsFromTable() {
    _syncCustomRowsFromDOM();
    const result = [];
    _offerPrzejscieRows.forEach((r) => {
        if (r.rodzaj && r.rodzaj.trim() !== '') {
            result.push({
                rodzaj: r.rodzaj.trim(),
                dnOd:
                    r.dnOd !== ''
                        ? String(r.dnOd).includes('/')
                            ? String(r.dnOd)
                            : parseFloat(r.dnOd)
                        : 0,
                dnDo:
                    r.dnDo !== ''
                        ? String(r.dnDo).includes('/')
                            ? String(r.dnDo)
                            : parseFloat(r.dnDo)
                        : 0,
                ilosc: r.ilosc || 1,
                uwagi: r.uwagi || '',
                czyPrzejscie: r.czyPrzejscie || 'TAK',
                source: 'offer'
            });
        }
    });
    _customPrzejscieRows.forEach((r) => {
        if (r.rodzaj && r.rodzaj.trim() !== '') {
            result.push({
                rodzaj: r.rodzaj.trim(),
                dnOd:
                    r.dnOd !== ''
                        ? String(r.dnOd).includes('/')
                            ? String(r.dnOd)
                            : parseFloat(r.dnOd)
                        : 0,
                dnDo:
                    r.dnDo !== ''
                        ? String(r.dnDo).includes('/')
                            ? String(r.dnDo)
                            : parseFloat(r.dnDo)
                        : 0,
                ilosc: r.ilosc || 1,
                uwagi: r.uwagi || '',
                czyPrzejscie: r.czyPrzejscie || 'TAK',
                source: 'custom'
            });
        }
    });
    return result;
}
