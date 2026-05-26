const fs = require('fs');
const https = require('https');
const path = require('path');

const fontsDir = path.join(__dirname, '..', 'public', 'css', 'fonts');
const cssFile = path.join(__dirname, '..', 'public', 'css', 'inter.css');

if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

const fontUrl = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap';

const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
  }
};

https.get(fontUrl, options, (res) => {
  let css = '';
  res.on('data', d => css += d);
  res.on('end', () => {
    const cssLines = css.split('\n');
    let urlsToDownload = [];
    
    const newCss = css.replace(/url\((https:\/\/[^)]+)\)/g, (match, url) => {
      const parts = url.split('/');
      const filename = 'inter-' + parts[parts.length - 1]; // Make a simple flat name, not using the hash yet. Wait, it might have same names?
      // Actually google fonts url ends with something like s/inter/v13/.....woff2
      // Let's generate a unique name
      const nameMatch = url.match(/s\/inter\/v[0-9]+\/(.+)\.woff2$/);
      let localFilename = nameMatch ? nameMatch[1].replace(/\//g, '-') + '.woff2' : 'inter-' + Math.random().toString(36).substring(7) + '.woff2';
      
      urlsToDownload.push({ url, localFilename });
      return `url('./fonts/${localFilename}')`;
    });

    fs.writeFileSync(cssFile, newCss);
    
    // Download each file sequentially
    const downloadNext = () => {
      if (urlsToDownload.length === 0) {
        console.log('All fonts downloaded and saved to css/inter.css!');
        return;
      }
      const item = urlsToDownload.shift();
      const fileStream = fs.createWriteStream(path.join(fontsDir, item.localFilename));
      https.get(item.url, (r) => {
        r.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`Downloaded ${item.localFilename}`);
          downloadNext();
        });
      });
    };
    
    downloadNext();
  });
}).on('error', e => console.error(e));
