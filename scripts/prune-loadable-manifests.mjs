// Post-build fix for two Turbopack quirks (Next 16) in a page's
// react-loadable-manifest.json. Next turns every file listed there into a
// <link rel="preload">, so:
//
// 1. Missing files: the manifest can list async chunks that were merged into
//    other chunks and never written to .next/static. Each product page then
//    requested a non-existent chunk (a 404 in the console and in Lighthouse).
// 2. Unreachable files: the manifest's chunk names come from the server
//    graph, so some entries name chunks the browser never runs on that route
//    (server-graph copies of a block, or a chunk group only another route
//    loads). Preloading them only costs bandwidth: the client loads the same
//    code from other files.
//
// The code itself loads fine from the chunks the client graph references, so
// dropping these entries only removes useless preloads. A file is kept when
// it is reachable from the route's entry scripts: the root main files, the
// route's client-reference entry chunks, and, transitively, every chunk path
// that a reachable chunk names (Turbopack's async loaders list them inline).

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

let rootMainFiles = [];
try {
  const build = JSON.parse(fs.readFileSync(path.join(distDir, 'build-manifest.json'), 'utf8'));
  rootMainFiles = Array.isArray(build.rootMainFiles) ? build.rootMainFiles : [];
} catch {
  // Without it the root files are simply not seeds; route entries still are.
}

const CHUNK_REF = /"(static\/chunks\/[^"\\]+?\.(?:js|css))"/g;
const chunkRefs = new Map();
function refsOf(file) {
  let refs = chunkRefs.get(file);
  if (!refs) {
    refs = [];
    const abs = path.join(distDir, file);
    if (file.endsWith('.js') && fs.existsSync(abs)) {
      for (const m of fs.readFileSync(abs, 'utf8').matchAll(CHUNK_REF)) refs.push(m[1]);
    }
    chunkRefs.set(file, refs);
  }
  return refs;
}

/**
 * Chunks the browser can load on the route that owns `loadableManifest`, or
 * null when its client-reference manifest is not found (then only missing
 * files are pruned).
 */
function reachableChunks(loadableManifest) {
  // <route>/page/react-loadable-manifest.json -> <route>/page_client-reference-manifest.js
  const segmentDir = path.dirname(loadableManifest);
  const crm = path.join(path.dirname(segmentDir), `${path.basename(segmentDir)}_client-reference-manifest.js`);
  if (!fs.existsSync(crm)) return null;
  const seeds = new Set(rootMainFiles);
  const text = fs.readFileSync(crm, 'utf8');
  for (const m of text.matchAll(/"(?:\/_next\/)?(static\/chunks\/[^"\\]+?\.(?:js|css))"/g)) seeds.add(m[1]);
  if (seeds.size === rootMainFiles.length) return null;
  const seen = new Set();
  const queue = [...seeds];
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const r of refsOf(f)) if (!seen.has(r)) queue.push(r);
  }
  return seen;
}

let missing = 0;
let unreachable = 0;
let files = 0;
for (const file of manifests(serverApp)) {
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  const reachable = reachableChunks(file);
  let changed = false;
  for (const entry of Object.values(manifest)) {
    if (!Array.isArray(entry?.files)) continue;
    const kept = entry.files.filter((f) => {
      if (!fs.existsSync(path.join(distDir, f))) {
        missing += 1;
        return false;
      }
      // Only JS entries are pruned as unreachable. A `.css` entry is kept
      // unless missing: Next renders a dynamic chunk's stylesheet links from
      // this manifest, and a wrongly dropped one would SSR the section
      // unstyled until hydration, while a wrongly dropped JS preload only
      // costs a later fetch.
      if (reachable && f.endsWith('.js') && !reachable.has(f)) {
        unreachable += 1;
        return false;
      }
      return true;
    });
    if (kept.length !== entry.files.length) {
      entry.files = kept;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
    files += 1;
  }
}
console.log(
  `prune-loadable-manifests: removed ${missing} missing and ${unreachable} unreachable chunk(s) from ${files} manifest(s)`,
);
