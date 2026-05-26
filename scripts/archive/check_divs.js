const fs = require('fs');
const content = fs.readFileSync('public/studnie.html', 'utf-8');
const lines = content.split(/\r?\n/);

// Better approach: count by tracking actual tag boundaries
let depth = 0;
for (let i = 0; i < lines.length; i++) {
  const lineNum = i + 1;
  const line = lines[i];
  
  // Count opening div tags: match lines that START a <div (could be multiline)
  // A div open is: the line contains '<div' followed by space, >, or end of line
  const opens = (line.match(/<div[\s>/]/g) || []).length;
  // Count closing div tags
  const closes = (line.match(/<\/div>/g) || []).length;
  
  const prevDepth = depth;
  depth += opens - closes;

  // Show all lines where depth changes in the critical area
  if ((opens > 0 || closes > 0) && lineNum >= 169 && lineNum <= 340) {
    console.log(`${String(lineNum).padStart(5)}: d=${String(prevDepth).padStart(3)}->${String(depth).padStart(3)} +${opens} -${closes} | ${line.trim().substring(0, 100)}`);
  }
}
console.log(`\n--- DEPTH at key lines ---`);

// Reset and track depth at critical boundary lines
depth = 0;
for (let i = 0; i < lines.length; i++) {
  const lineNum = i + 1;
  const line = lines[i];
  const opens = (line.match(/<div[\s>/]/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  depth += opens - closes;
  
  if ([171, 172, 180, 281, 321, 328, 329, 331, 618, 2310, 2313, 2686, 2687, 2688, 2690, 2691, 2694, 3120, 3122, 3124, 3126].includes(lineNum)) {
    console.log(`LINE ${String(lineNum).padStart(5)}: depth=${String(depth).padStart(3)} | ${line.trim().substring(0, 90)}`);
  }
}
console.log(`\nFinal depth: ${depth}`);
