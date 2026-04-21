#!/usr/bin/env node
/**
 * Betty AI — doctor: "what's broken right now?" one-shot check.
 *
 * Runs the things that silently fail during normal use and prints a punch
 * list. Exits 0 if everything's green, 1 if anything red.
 *
 * Usage: npm run doctor
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');
const HOST = process.env.BETTY_SSH_HOST || 'jvadala@login.betty.parcc.upenn.edu';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const results = [];
function record(name, ok, detail, fixHint) {
  results.push({ name, ok, detail, fixHint });
}

function runQuick(cmd, args, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (c) => (stdout += c.toString()));
    child.stderr?.on('data', (c) => (stderr += c.toString()));
    const t = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.once('close', (code) => {
      clearTimeout(t);
      resolve({ code: code ?? -1, stdout, stderr });
    });
    child.once('error', () => {
      clearTimeout(t);
      resolve({ code: -1, stdout, stderr });
    });
  });
}

function readEnvLocal() {
  const p = resolve(REPO, '.env.local');
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  const env = readEnvLocal();

  // 1. Kerberos ticket valid
  const krb = await runQuick('klist', ['-s']);
  record(
    'Kerberos ticket',
    krb.code === 0,
    krb.code === 0 ? 'valid' : 'missing or expired',
    'kinit jvadala@UPENN.EDU  (or run scripts/install-kinit-renewal.sh)',
  );

  // 2. SSH ControlMaster alive (depends on #1, but cheap to try)
  const cm = await runQuick('ssh', ['-O', 'check', HOST]);
  record(
    'SSH ControlMaster',
    cm.code === 0,
    cm.code === 0 ? cm.stderr.trim() : 'not running',
    `ssh ${HOST}  # approve Duo in a normal terminal`,
  );

  // 3. SSH works end-to-end (only if CM up)
  if (cm.code === 0) {
    const ping = await runQuick('ssh', ['-o', 'BatchMode=yes', HOST, 'hostname'], 6000);
    record(
      'SSH -> Betty',
      ping.code === 0 && ping.stdout.trim().length > 0,
      ping.code === 0 ? `reached ${ping.stdout.trim()}` : ping.stderr.trim().slice(0, 140),
      'rerun `ssh login.betty.parcc.upenn.edu` to refresh the socket',
    );
  }

  // 4. .env.local has what's needed for the provider paths we ship
  record(
    'ANTHROPIC_API_KEY (for Claude Code provider)',
    !!env.ANTHROPIC_API_KEY?.trim() || !!process.env.ANTHROPIC_API_KEY?.trim(),
    env.ANTHROPIC_API_KEY?.trim() ? 'set' : 'unset (optional if using Claude subscription CLI auth)',
    'set ANTHROPIC_API_KEY in .env.local',
  );
  record(
    'LITELLM_API_KEY (for PARCC LiteLLM provider)',
    !!env.LITELLM_API_KEY?.trim(),
    env.LITELLM_API_KEY?.trim() ? 'set' : 'unset',
    'set LITELLM_API_KEY in .env.local',
  );

  // 5. node_modules installed
  record(
    'node_modules',
    existsSync(resolve(REPO, 'node_modules', 'next')),
    existsSync(resolve(REPO, 'node_modules', 'next')) ? 'next installed' : 'missing',
    'npm install',
  );

  // 6. Wiki + betty-ai paths resolvable
  const wikiPath = env.WIKI_PATH || '../wiki';
  const bettyPath = env.BETTY_AI_PATH || '../betty-ai';
  record(
    'wiki/ directory',
    existsSync(resolve(REPO, wikiPath)),
    `${wikiPath} -> ${existsSync(resolve(REPO, wikiPath)) ? 'found' : 'missing'}`,
    'set WIKI_PATH in .env.local',
  );
  record(
    'betty-ai/ directory',
    existsSync(resolve(REPO, bettyPath)),
    `${bettyPath} -> ${existsSync(resolve(REPO, bettyPath)) ? 'found' : 'missing'}`,
    'set BETTY_AI_PATH in .env.local',
  );

  // Print punch list
  let redCount = 0;
  console.log('');
  console.log('Betty AI doctor — checks run at', new Date().toISOString());
  console.log('');
  for (const r of results) {
    const mark = r.ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`  ${mark} ${r.name.padEnd(46)} ${DIM}${r.detail}${RESET}`);
    if (!r.ok) {
      console.log(`     ${YELLOW}fix:${RESET} ${r.fixHint}`);
      redCount++;
    }
  }
  console.log('');
  if (redCount === 0) {
    console.log(`${GREEN}All green — Betty is ready.${RESET}`);
    process.exit(0);
  } else {
    console.log(`${RED}${redCount} check${redCount === 1 ? '' : 's'} failed — fix the items above and rerun \`npm run doctor\`.${RESET}`);
    process.exit(1);
  }
}

main();
