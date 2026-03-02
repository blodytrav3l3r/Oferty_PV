const fs = require('fs');
const path = require('path');

const pricelistPath = path.join('d:', 'Antigravity', 'pricelist.js');
let content = fs.readFileSync(pricelistPath, 'utf8');

function getProductDiameter(id) {
    const parts = id.split('-');
    if (parts.length >= 3) {
        const code = parseInt(parts[2]);
        if (!isNaN(code) && code > 0) return code * 100;
    }
    return null;
}

function getProductLength(id) {
    const parts = id.split('-');
    if (parts.length >= 4) {
        const code = parseInt(parts[3]);
        if (!isNaN(code) && code >= 10) return code * 100;
    }
    return null;
}

function getPipeInnerArea(id) {
    const d = getProductDiameter(id);
    const l = getProductLength(id);
    if (!d || !l) return 0;

    if (id.startsWith('RJB') || id.startsWith('RJZ')) {
        const h = d * 1.5;
        const perimeter = Math.PI * ((d + h) / 2) / 1000;
        return perimeter * (l / 1000);
    }
    return Math.PI * (d / 1000) * (l / 1000);
}

// eval the current DEFAULT_PRODUCTS array somehow, or just regex replace
// Better: regex replace each item line
const updatedContent = content.replace(/\{ id: "([^"]+)", name: "([^"]+)", price: ([^,]+), transport: ([^,]+), weight: ([^,]+), category: "([^"]+)" \}/g, (match, id, name, price, transport, weight, category) => {
    const area = getPipeInnerArea(id);
    let areaStr = area > 0 ? `, area: ${Math.ceil(area * 100) / 100}` : '';
    if (category === "Akcesoria PEHD") {
        areaStr = ', area: 1';
    } else if (category === "Uszczelki") {
        areaStr = ', area: null';
    }
    return `{ id: "${id}", name: "${name}", price: ${price}, transport: ${transport}, weight: ${weight}, category: "${category}"${areaStr} }`;
});

fs.writeFileSync(pricelistPath, updatedContent, 'utf8');
console.log("Updated pricelist lines with areas!");
