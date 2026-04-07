import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const envPath = path.join(root, '.env');

function fail(message) {
  console.error(`\n[deploy:fe] ${message}`);
  process.exit(1);
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    fail('Khong tim thay .env. Hay copy tu .env.example roi dien thong tin.');
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const out = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }

  return out;
}

function run(cmd, args, options = {}) {
  const res = spawnSync(cmd, args, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, ...(options.env ?? {}) },
    input: options.input,
  });

  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);

  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed`);
  }

  return `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
}

// --- Main ---

const env = loadEnv(envPath);
for (const key of ['PAGES_PROJECT_NAME']) {
  if (!env[key]) fail(`Thieu bien trong .env: ${key}`);
}

// Determine API URL: prefer WORKER_PUBLIC_URL, then try to build from WORKER_NAME
const apiUrl = env.WORKER_PUBLIC_URL;
if (!apiUrl) {
  fail(
    'Can set WORKER_PUBLIC_URL trong .env de deploy FE rieng.\n' +
    '  (Vi khong deploy worker nen khong the tu detect URL.)'
  );
}

console.log(`[deploy:fe] API URL: ${apiUrl}`);

console.log('[deploy:fe] Building frontend...');
run('npm', ['run', 'build'], {
  cwd: path.join(root, 'fe'),
  env: { VITE_API_URL: apiUrl },
});

console.log('[deploy:fe] Deploying frontend to Cloudflare Pages...');
run('npx', [
  'wrangler',
  'pages',
  'deploy',
  'fe/.svelte-kit/cloudflare',
  '--project-name',
  env.PAGES_PROJECT_NAME,
  '--commit-dirty=true',
]);

console.log('\n[deploy:fe] Done. ✅');
