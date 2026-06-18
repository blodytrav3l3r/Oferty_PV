/**
 * Skrypt migracyjny: zamiana emoji na tagi Lucide <i data-lucide="..."></i>
 * 
 * Problem poprzedniej wersji: regex Unicode nie łapał wielobajtowych emoji
 * (np. 🏗️ = U+1F3D7 + U+FE0F), więc powstawały tagi data-lucide="undefined".
 * 
 * Rozwiązanie: iterujemy po konkretnych string-ach emoji z mapy, 
 * zamieniając je dokładnie (string.replaceAll).
 */
const fs = require('fs');
const path = require('path');

// Mapa emoji → nazwa ikony Lucide
const ICON_MAP = {
    '📋': 'clipboard-list',
    '💾': 'save',
    '🔄': 'refresh-cw',
    '📂': 'folder-open',
    '📝': 'edit',
    '📦': 'package',
    '🏠': 'home',
    '🏗️': 'hard-hat',
    '🔩': 'wrench',
    '🗄️': 'archive',
    '👤': 'user',
    '✏️': 'pencil',
    '🗑️': 'trash-2',
    '📊': 'bar-chart-2',
    '📄': 'file-text',
    '📤': 'upload',
    '📥': 'download',
    '🔼': 'chevron-up',
    '🔽': 'chevron-down',
    '➕': 'plus',
    '⏳': 'hourglass',
    '📅': 'calendar',
    '💰': 'banknote',
    '🚚': 'truck',
    '🏭': 'factory',
    '✅': 'check-circle-2',
    '⚠️': 'alert-triangle',
    '🚪': 'log-out',
    '🔑': 'key',
    '🔐': 'lock',
    '♻️': 'recycle',
    '👥': 'users',
    '🔧': 'settings',
    '⚙️': 'settings',
    '🖨️': 'printer',
    '🖨': 'printer',
    '🏷️': 'tag',
    '🏷': 'tag',
    '🗂️': 'folder-open',
    '🗂': 'folder-open',
    '🛡️': 'shield',
    '🛡': 'shield',
    '🏋️': 'dumbbell',
    '🏋': 'dumbbell',
    '🛣️': 'route',
    '🛣': 'route',
    '🤖': 'bot',
    '🟢': 'circle-check',
    '🔴': 'circle-x',
    // Dodatkowe emoji znalezione w skanowaniu
    '✕': 'x',
    '✔': 'check',
    '✓': 'check',
    '🔍': 'search',
    '📏': 'ruler',
    '✎': 'pencil',
    '🏢': 'building-2',
    '🧑': 'user',
    '💼': 'briefcase',
    '✍': 'pen-tool',
    '📞': 'phone',
    '✨': 'sparkles',
    '➔': 'arrow-right',
    '👁': 'eye',
    '💻': 'monitor',
    '📜': 'scroll-text',
    '❌': 'x-circle',
    '🕐': 'clock',
    '❓': 'help-circle',
    '🔶': 'diamond',
    '❗': 'alert-circle',
    '🧠': 'brain',
    '🖐': 'hand',
    '🖐️': 'hand',
    '🛢': 'cylinder',
    '🛢️': 'cylinder',
    '🔌': 'plug',
    '🔘': 'circle-dot',
    '🟦': 'square',
    '🟪': 'square',
    '🟩': 'square',
    '📍': 'map-pin',
    '🚫': 'ban',
    '🔗': 'link',
    '📐': 'triangle-right',
    '🔒': 'lock',
    '🔓': 'unlock',
    '💧': 'droplets',
    '🧱': 'brick-wall',
    '📖': 'book-open',
    '🔵': 'circle',
    '🟣': 'circle',
    '🟠': 'circle',
};

function replaceEmojisInContent(content) {
    let result = content;
    let count = 0;

    // Sortujemy klucze od najdłuższych do najkrótszych,
    // żeby warianty z variation selector (️) były dopasowane przed samym base emoji
    const sortedKeys = Object.keys(ICON_MAP).sort((a, b) => b.length - a.length);

    for (const emoji of sortedKeys) {
        const iconName = ICON_MAP[emoji];
        const tag = `<i data-lucide="${iconName}"></i>`;

        // Zlicz wystąpienia
        let idx = 0;
        while ((idx = result.indexOf(emoji, idx)) !== -1) {
            count++;
            idx += emoji.length;
        }

        result = result.split(emoji).join(tag);
    }

    return { result, count };
}

function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');

    // Tylko zamieniaj emoji, nie dodawaj skryptów automatycznie
    const { result, count } = replaceEmojisInContent(content);

    if (count > 0) {
        fs.writeFileSync(filePath, result, 'utf8');
        console.log(`  ✔ ${path.relative(process.cwd(), filePath)}: ${count} zamian`);
    }

    return count;
}

function addLucideScripts(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes('lucide.min.js') || content.includes('lucide@latest')) {
        return; // Już posiada bibliotekę lucide
    }

    // Dodaj przed </body>
    if (content.includes('</body>')) {
        const scripts = 
`    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"><\/script>
    <script src="js/shared/iconMap.js?v=1.6"><\/script>
`;
        content = content.replace('</body>', scripts + '</body>');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  ✔ Dodano skrypty Lucide do ${path.basename(filePath)}`);
    }
}

// --- Główna logika (Main) ---
const publicDir = path.join(__dirname, 'public');

console.log('\n=== FAZA 1: Zamiana emoji w plikach HTML ===');
const htmlFiles = [
    'index.html', 'app.html', 'rury.html', 'studnie.html', 
    'kartoteka.html', 'zlecenia.html',
    'templates/etykieta.html', 'templates/oferta_studnie.html', 'templates/zlecenie.html'
];
let totalHtml = 0;
for (const f of htmlFiles) {
    const fp = path.join(publicDir, f);
    if (fs.existsSync(fp)) {
        totalHtml += processFile(fp);
    }
}
console.log(`  Razem HTML: ${totalHtml} zamian\n`);

console.log('=== FAZA 2: Zamiana emoji w plikach JS ===');
function findJsFiles(dir) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findJsFiles(full));
        } else if (entry.name.endsWith('.js') && !entry.name.includes('iconMap')) {
            results.push(full);
        }
    }
    return results;
}

let totalJs = 0;
for (const jsFile of findJsFiles(path.join(publicDir, 'js'))) {
    totalJs += processFile(jsFile);
}
console.log(`  Razem JS: ${totalJs} zamian\n`);

console.log('=== FAZA 3: Dodawanie skryptów Lucide do HTML ===');
for (const f of htmlFiles) {
    const fp = path.join(publicDir, f);
    if (fs.existsSync(fp)) {
        addLucideScripts(fp);
    }
}

console.log(`\n=== GOTOWE: ${totalHtml + totalJs} zamian łącznie ===\n`);
