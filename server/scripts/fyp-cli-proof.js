#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.resolve(__dirname, '..');
const ROOT = path.resolve(SERVER, '..');
const API = process.env.OPUS_API_URL || 'http://127.0.0.1:5001';

function hr(title) {
  console.log('\n' + '='.repeat(64));
  console.log(title);
  console.log('='.repeat(64));
}

function showModules() {
  hr('PROOF A — API MODULE MAP (matches server.js mounts)');
  const serverJs = fs.readFileSync(path.join(SERVER, 'server.js'), 'utf8');
  const mounts = [...serverJs.matchAll(/app\.use\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)/g)].map(
    (m) => ({ path: m[1], varName: m[2] })
  );
  console.log('Mounted from server.js:\n');
  for (const m of mounts) {
    console.log(`  ${m.path.padEnd(22)} ← ${m.varName}`);
  }
  console.log('\nRoute files in server/routes/:');
  const routesDir = path.join(SERVER, 'routes');
  for (const f of fs.readdirSync(routesDir).filter((x) => x.endsWith('.js')).sort()) {
    console.log(`  - ${f}`);
  }
}

function showPipeline() {
  hr('PROOF B — API REQUEST PIPELINE (middleware used in routes)');
  console.log(`Typical protected request order in OPUS:\n`);
  console.log(`  1. Client (React)  →  HTTP JSON / multipart`);
  console.log(`  2. Route module    →  /api/<area>/...`);
  console.log(`  3. Middleware chain (route-dependent):`);
  console.log(`       - protect (JWT)`);
  console.log(`       - requireOnboardingComplete`);
  console.log(`       - requireEmployer / Freelancer / Admin / Verified`);
  console.log(`       - multer upload* (when files are sent)`);
  console.log(`  4. Controller handler function`);
  console.log(`  5. Utility / ledger helpers (optional)`);
  console.log(`  6. MongoDB (Mongoose models)`);
  console.log(`  7. External APIs when needed (Google / eSewa / Khalti / LiveKit)`);
  console.log(`  8. JSON response → Client`);

  const authMw = path.join(SERVER, 'middleware', 'auth.js');
  const uploadMw = path.join(SERVER, 'middleware', 'upload.js');
  console.log('\nMiddleware source files:');
  console.log(`  - ${path.relative(ROOT, authMw)} ${fs.existsSync(authMw) ? '(found)' : '(missing)'}`);
  console.log(`  - ${path.relative(ROOT, uploadMw)} ${fs.existsSync(uploadMw) ? '(found)' : '(missing)'}`);

  const routesDir = path.join(SERVER, 'routes');
  let protectHits = 0;
  for (const f of fs.readdirSync(routesDir).filter((x) => x.endsWith('.js'))) {
    const t = fs.readFileSync(path.join(routesDir, f), 'utf8');
    protectHits += (t.match(/\bprotect\b/g) || []).length;
  }
  console.log(`\nApprox. "protect" references across route files: ${protectHits}`);
}

function showIntegration() {
  hr('PROOF C — FRONTEND ↔ BACKEND INTEGRATION (repo layout)');
  const client = path.join(ROOT, 'client');
  const server = SERVER;
  console.log('Monorepo layout:');
  console.log(`  client/  → React + Vite UI`);
  console.log(`  server/  → Express + Socket.IO API`);
  console.log('');
  console.log('Key folders:');
  for (const p of [
    'client/src',
    'client/src/services',
    'server/routes',
    'server/controllers',
    'server/middleware',
    'server/models',
    'server/utils',
  ]) {
    const full = path.join(ROOT, p);
    console.log(`  ${p.padEnd(28)} ${fs.existsSync(full) ? 'OK' : 'missing'}`);
  }

  const envExamples = ['client/.env', 'client/.env.example', 'server/.env.example'];
  console.log('\nConfig hints (names only, no secrets printed):');
  for (const rel of envExamples) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) continue;
    const lines = fs
      .readFileSync(full, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='));
    const keys = lines.map((l) => l.split('=')[0]).filter(Boolean);
    console.log(`  ${rel}: ${keys.slice(0, 8).join(', ')}${keys.length > 8 ? ', ...' : ''}`);
  }
  console.log('\nLive demo note: when SERVE_CLIENT=true, Express also serves client/dist.');
}

async function showHealth() {
  hr(`PROOF D — LIVE API CHECK (${API})`);
  const url = `${API.replace(/\/$/, '')}/api/health`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log(`GET ${url}`);
    console.log(`HTTP ${res.status}`);
    console.log(`Body: ${text.slice(0, 300)}`);
    if (res.ok) console.log('\nResult: backend is reachable from this machine.');
    else console.log('\nResult: server responded but not OK.');
  } catch (e) {
    console.log(`GET ${url}`);
    console.log(`Failed: ${e.message}`);
    console.log('\nStart the API first, then re-run:');
    console.log('  cd server && npm run dev');
    console.log('  node scripts/fyp-cli-proof.js health');
  }
}

const cmd = process.argv[2] || 'all';

async function main() {
  console.log('OPUS FYP CLI proof (screenshot these terminal outputs for Execution appendix)');
  if (cmd === 'modules' || cmd === 'all') showModules();
  if (cmd === 'pipeline' || cmd === 'all') showPipeline();
  if (cmd === 'integration' || cmd === 'all') showIntegration();
  if (cmd === 'health' || cmd === 'all') await showHealth();
  console.log('');
}

main();
