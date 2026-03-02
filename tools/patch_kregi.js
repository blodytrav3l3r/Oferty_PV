const fs = require('fs');

const fileContent = fs.readFileSync('pricelist_studnie.js', 'utf8');

// The file has:
// const DEFAULT_PRODUCTS_STUDNIE = [ ... ];
// const CATEGORIES_STUDNIE = [ ... ];
// We can extract them exactly.

const productsMatch = fileContent.match(/const DEFAULT_PRODUCTS_STUDNIE = (\[[\s\S]*?\]);\s*const CATEGORIES_STUDNIE =/);
if (!productsMatch) {
    console.error("Could not find DEFAULT_PRODUCTS_STUDNIE");
    process.exit(1);
}

// Safely evaluate to get array
let products = [];
try {
    eval('products = ' + productsMatch[1] + ';');
} catch (e) {
    console.error("Eval failed", e);
    process.exit(1);
}

const newProducts = [];
const seenIds = new Set();

products.forEach(p => {
    // Keep the original item
    if (!seenIds.has(p.id)) {
        newProducts.push(p);
        seenIds.add(p.id);
    }

    // Check if it's a krag. Currently they are named like "Krąg DN1000/250" and ID is KDB-10-02-D or KDB-10-05-OT
    if (p.componentType === 'krag' && p.id.startsWith('KDB-') && p.id.endsWith('-D')) {
        const baseId = p.id.substring(0, p.id.length - 2); // gets "KDB-10-02"
        const baseSizePrefix = baseId.substring(4); // gets "10-02"

        const baseName = p.name; // e.g., "Krąg DN1000/250"

        const variants = [
            {
                id: `KDZ-${baseSizePrefix}-D`,
                name: baseName.replace('Krąg', 'Krąg żelbetowy')
            },
            {
                id: `KDB-${baseSizePrefix}-N`,
                name: `${baseName} drabinka nierdzewna`
            },
            {
                id: `KDZ-${baseSizePrefix}-N`,
                name: `${baseName.replace('Krąg', 'Krąg żelbetowy')} drabinka nierdzewna`
            },
            {
                id: `KDB-${baseSizePrefix}-B`,
                name: `${baseName} bez stopni`
            },
            {
                id: `KDZ-${baseSizePrefix}-B`,
                name: `${baseName.replace('Krąg', 'Krąg żelbetowy')} bez stopni`
            }
        ];

        variants.forEach(v => {
            if (!seenIds.has(v.id)) {
                let pCopy = { ...p, ...v };
                newProducts.push(pCopy);
                seenIds.add(v.id);
            }
        });
    }

    // What if it is a krag but with -OT? The user said "kręgi żelbetowe", "zamiast D ma być N .. i zamiast D ma być w indeksie B". This implies the variants specifically replace the D. 
    // Wait, does the requested variants apply to OT items? The user didn't mention OT. The instructions say "zamiast D ma być N", "zamiast D ma być B". This means we specifically target the rings with `-D`.
});

// Now reconstruct the file
const newFileContent = `/* ===== DEFAULT PRODUCT DATA — STUDNIE ===== */
const DEFAULT_PRODUCTS_STUDNIE = ${JSON.stringify(newProducts, null, 4)};

const CATEGORIES_STUDNIE = [
    "Studnie DN1000",
    "Studnie DN1200",
    "Studnie DN1500",
    "Studnie DN2000",
    "Akcesoria studni",
    "Uszczelki studni",
    "Przejścia"
];
`;

fs.writeFileSync('pricelist_studnie.js', newFileContent, 'utf8');
console.log("Updated pricelist_studnie.js successfully. Total items:", newProducts.length);
