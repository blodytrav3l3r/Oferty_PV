const fs = require('fs');

const content = fs.readFileSync('public/js/studnie/orderManager.js', 'utf-8');

let newContent = content.replace(
    /\<span id="zl-przejscia-app-icon"([^>]+)\>\$\{przejsciaAppVisible \? '\<i data-lucide="chevron-up"\>\<\/i\>' : '\<i data-lucide="chevron-down"\>\<\/i\>'\}\<\/span\>/,
    '<span id="zl-przejscia-app-icon"$1><i data-lucide="chevron-up"></i></span>'
);

newContent = newContent.replace(
    /\<div id="zl-inline-przejscia-app-container"([^>]+)display:\$\{przejsciaAppVisible \? 'block' : 'none'\};"/,
    '<div id="zl-inline-przejscia-app-container"$1display:block;"'
);

fs.writeFileSync('public/js/studnie/orderManager.js', newContent);
