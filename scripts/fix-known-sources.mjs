#!/usr/bin/env node
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const remote = args.includes('--remote');
const dbName = process.env.D1_DB_NAME || 'newsdigest';

function run(sql) {
  const escaped = sql.replace(/"/g, '\\"');
  const remoteFlag = remote ? ' --remote' : '';
  const cmd = `npx wrangler d1 execute ${dbName}${remoteFlag} --command "${escaped}"`;
  console.log(`\n[fix-known-sources] ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

console.log(`[fix-known-sources] Target DB: ${dbName} (${remote ? 'remote' : 'local'})`);

run(`
UPDATE sources
SET url = 'https://blog.cloudflare.com/rss/', type = 'rss'
WHERE url LIKE 'https://blog.cloudflare.com%'
  AND (url <> 'https://blog.cloudflare.com/rss/' OR type <> 'rss');
`);

run(`
UPDATE sources
SET url = 'https://vercel.com/blog', type = 'html'
WHERE url LIKE 'https://vercel.com/blog%'
  AND (url <> 'https://vercel.com/blog' OR type <> 'html');
`);

run(`
SELECT id, name, url, type, enabled, last_fetched_at
FROM sources
WHERE url LIKE '%blog.cloudflare.com%' OR url LIKE '%vercel.com/blog%'
ORDER BY created_at;
`);

console.log('\n[fix-known-sources] Done.');
