import fs from 'fs';
import path from 'path';

const root = path.join(process.cwd(), 'frontends');

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', 'dist'].includes(entry.name)) walk(p);
    else if (/\.(jsx|js)$/.test(entry.name)) fixFile(p);
  }
}

function fixFile(filePath) {
  let c = fs.readFileSync(filePath, 'utf8');
  const orig = c;
  c = c.replace(/R\$\{([^}]+)\}/g, '${formatUSD($1)}');
  if (c === orig) return;
  if (!c.includes("from '@/lib/formatCurrency'") && !c.includes('from "@/lib/formatCurrency"')) {
    c = `import { formatUSD } from '@/lib/formatCurrency';\n${c}`;
  }
  fs.writeFileSync(filePath, c);
  console.log('fixed', path.relative(process.cwd(), filePath));
}

walk(root);
