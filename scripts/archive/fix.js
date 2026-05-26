const fs = require('fs');
let html = fs.readFileSync('public/studnie.html', 'utf8');

const regex = /<div style=\"display: flex; gap: 1rem; align-items: flex-start; flex-wrap: wrap; padding: 1\.2rem; border: 1px solid #1e293b;[^\"]*background: rgba\(255,255,255,0\.02\);[^\"]*\"/g;
html = html.replace(regex, '<div style=\"display: flex; gap: 1rem; align-items: flex-start; flex-wrap: wrap; padding: 1.2rem; border: 1px solid #1e293b; border-radius: 8px; background: rgba(255,255,255,0.02); margin-bottom: 0.8rem;\"');

fs.writeFileSync('public/studnie.html', html);
console.log("Done");
