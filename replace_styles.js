const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public/js/studnie');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

const replacements = {
    'font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.1rem; letter-spacing:0.5px;': 'ui-text-muted-sm',
    'color:var(--text-muted);': 'ui-text-mute',
    'color:var(--text-secondary);': 'ui-text-sec',
    'padding:0.35rem 0.5rem; font-size:0.65rem;': 'ui-badge',
    'padding:0.3rem 0.4rem; font-size:0.7rem;': 'ui-badge-sm',
    'width: 5%;': 'ui-col-5',
    'width: 6%;': 'ui-col-6',
    'width: 8%;': 'ui-col-8',
    'display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;': 'ui-row-gap',
    'text-align:center; min-width:60px;': 'ui-center-min',
    'font-size:0.78rem;': 'ui-text-lg',
    'font-size:0.72rem;': 'ui-text-sm',
    'cursor:pointer; font-weight:600;': 'ui-pointer-bold',
    'display:flex; justify-content:space-between; align-items:center;': 'ui-flex-between'
};

let totalReplaced = 0;

files.forEach(f => {
    let content = fs.readFileSync(path.join(dir, f), 'utf8');
    let replaced = 0;
    
    for (const [styleStr, className] of Object.entries(replacements)) {
        // Regex to match exact style="..." or style=\"...\"
        // Need to escape special regex chars in styleStr
        const escapedStyle = styleStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Match style="styleStr"
        const r1 = new RegExp(`style="${escapedStyle}"`, 'g');
        content = content.replace(r1, () => { replaced++; return `class="${className}"`; });
        
        // Match style=\\"styleStr\\"
        const r2 = new RegExp(`style=\\\\\\"${escapedStyle}\\\\\\"`, 'g');
        content = content.replace(r2, () => { replaced++; return `class=\\"${className}\\"`; });
    }
    
    if (replaced > 0) {
        fs.writeFileSync(path.join(dir, f), content);
        console.log(`Replaced ${replaced} styles in ${f}`);
        totalReplaced += replaced;
    }
});

console.log(`Total styles replaced: ${totalReplaced}`);
