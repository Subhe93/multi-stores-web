// Post-build fix for a Turbopack quirk (Next 16): a page's
// react-loadable-manifest.json can list async chunks that were merged into
// other chunks and never written to .next/static. Next turns every listed
// file into a <link rel="preload">, so each product page requested a
// non-existent chunk (a 404 in the console and in Lighthouse). The code
// itself loads fine from the chunks that do exist, so dropping the missing
// entries only removes the dead preloads.

import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.argv[2] ?? '.next');
const serverApp = path.join(distDir, 'server', 'app');

function* manifests(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* manifests(p);
    else if (entry.name === 'react-loadable-manifest.json') yield p;
  }
}

if (!fs.existsSync(serverApp)) {
  console.error(`prune-loadable-manifests: ${serverApp} not found (run next build first)`);
  process.exit(1);
}

let pruned = 0;
let files = 0;
for (const file of manifests(serverApp)) {
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  let changed = false;
  for (const entry of Object.values(manifest)) {
    if (!Array.isArray(entry?.files)) continue;
    const kept = entry.files.filter((f) => fs.existsSync(path.join(distDir, f)));
    if (kept.length !== entry.files.length) {
      pruned += entry.files.length - kept.length;
      entry.files = kept;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
    files += 1;
  }
}
console.log(`prune-loadable-manifests: removed ${pruned} missing chunk(s) from ${files} manifest(s)`);
