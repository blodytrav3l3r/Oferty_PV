const fs = require('fs');
let html = fs.readFileSync('public/studnie.html', 'utf-8');
const regex = /<div style="display: flex; gap: 1rem; margin-top: 1rem;">[\s\S]*?<div style="flex: 1; min-width: 120px;">[\s\S]*?<label.*?Rabat.*?%[\s\S]*?<\/div>\s*<\/div>/;
html = html.replace(regex, '');
fs.writeFileSync('public/studnie.html', html);
console.log("Done");
