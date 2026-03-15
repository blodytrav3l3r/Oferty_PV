const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public/js/studnie');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
const map = {};

files.forEach(f => {
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    const regex = /style=\\"([^\\]+?)\\"|style="([^"]+?)"/g;
    let m;
    while ((m = regex.exec(content)) !== null) {
        const s = m[1] || m[2];
        if (s) {
            map[s] = (map[s] || 0) + 1;
        }
    }
});

const sorted = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 30);
console.log(sorted.map(x => `${x[1]}x:\t${x[0]}`).join('\n'));
