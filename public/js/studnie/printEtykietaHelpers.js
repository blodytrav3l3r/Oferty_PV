// @ts-check
/* ===== HELPERY ETYKIET (WYDRUK) ===== */
/* buildEtykietaElements, getCertificationData, buildEtykietaHtml */
/* Zależności: studnieProducts, renderTemplate (globalne) */

function buildEtykietaElements(data) {
    const well = data.well;
    const config = well.config || [];
    const items = [];
    const countMap = new Map();

    config.forEach((item) => {
        const productId = item.productId || item.id;
        const product = studnieProducts.find((p) => p.id === productId);
        if (!product) return;

        if (product.componentType === 'kineta' || product.componentType === 'wlaz') return;

        const key = product.id;
        if (countMap.has(key)) {
            countMap.get(key).count++;
        } else {
            countMap.set(key, { count: 1, indeks: product.id || '', nazwa: product.name || '' });
        }
    });

    const uszczelkaProduct = studnieProducts.find(
        (p) =>
            p.category === 'uszczelka' &&
            (String(p.dn) === String(well.dn) ||
                p.name?.includes('DN ' + well.dn) ||
                p.name?.includes('DN' + well.dn))
    );

    if (uszczelkaProduct && config.length > 1) {
        countMap.set('_seal_' + uszczelkaProduct.id, {
            count: config.length,
            indeks: uszczelkaProduct.id || '',
            nazwa: uszczelkaProduct.name || `USZCZELKI DO STUDNI DN ${well.dn}MM`
        });
    }

    countMap.forEach((val) =>
        items.push({ ilosc: val.count + ' szt.', indeks: val.indeks, nazwa: val.nazwa })
    );
    return items;
}

function getCertificationData(dn) {
    const dnStr = String(dn || '');
    const match = dnStr.match(/(\d{3,4})/);
    const numDn = match ? parseInt(match[1]) : 0;

    if ([1000, 1200].includes(numDn)) {
        return {
            img: 'images/ce-mark.png',
            alt: 'CE',
            text: 'AT/2009-03-1733'
        };
    }

    return {
        img: 'images/b-mark.png',
        alt: 'B',
        text: 'IBDIM KOT 2018/0195 WYD.2<br>KDWU B/73/2023'
    };
}

function buildEtykietaHtml(template, data) {
    const elementy = buildEtykietaElements(data);
    const mainElement = data.product?.name || '';

    const elementRows = elementy
        .map(
            (e) => `
        <tr>
            <td class="el-qty">${e.ilosc}</td>
            <td class="el-idx">${e.indeks}</td>
            <td class="el-name">${e.nazwa}</td>
        </tr>
    `
        )
        .join('');

    const cert = getCertificationData(data.srednica);

    const payload = {
        SNR: data.snr || '',
        MAIN_ELEMENT: mainElement,
        NR_ZLECENIA: data.productionOrderNumber || '',
        ELEMENTY_ROWS: elementRows,
        CERT_IMG: cert.img,
        CERT_ALT: cert.alt,
        CERT_TEXT: cert.text
    };

    return renderTemplate(template, payload);
}

window.buildEtykietaElements = buildEtykietaElements;
window.getCertificationData = getCertificationData;
window.buildEtykietaHtml = buildEtykietaHtml;
