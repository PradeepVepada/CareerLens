#!/usr/bin/env node
/**
 * cache.mjs — Company research cache manager.
 * Usage: node cache.mjs [--list] [--clear] [--clear-company=X] [--ttl=X]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const CACHE_PATH = resolve(__dirname, 'data', 'companies-cache.json');
const DEFAULT_TTL_DAYS = 30;

function loadCache() {
  if (!existsSync(CACHE_PATH)) return {};
  try { return JSON.parse(readFileSync(CACHE_PATH, 'utf-8')); } catch { return {}; }
}

function saveCache(cache) {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
}

function main() {
  const cache = loadCache();
  
  if (args.includes('--list')) {
    console.log('\nCompany Research Cache:\n');
    const entries = Object.entries(cache);
    if (entries.length === 0) { console.log('  Empty.'); return; }
    for (const [name, data] of entries) {
      const age = Math.round((Date.now() - new Date(data.researched_date).getTime()) / 86400000);
      const ttl = data.ttl_days || DEFAULT_TTL_DAYS;
      const status = age > ttl ? 'EXPIRED' : 'valid';
      console.log(`  ${name}: ${status} (${age}d old, TTL ${ttl}d) — ${data.researched_date}`);
    }
    return;
  }
  
  if (args.includes('--clear')) {
    saveCache({});
    console.log('Cache cleared.');
    return;
  }
  
  const clearCompany = args.find(a => a.startsWith('--clear-company='))?.split('=')[1];
  if (clearCompany) {
    const key = clearCompany.toLowerCase();
    if (cache[key]) { delete cache[key]; saveCache(cache); console.log(`Cleared: ${clearCompany}`); }
    else { console.log(`Not found: ${clearCompany}`); }
    return;
  }
  
  console.log('\nCache manager commands:');
  console.log('  --list              Show cached companies');
  console.log('  --clear             Clear entire cache');
  console.log('  --clear-company=X   Clear specific company');
}

main();
