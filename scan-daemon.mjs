#!/usr/bin/env node

/**
 * scan-daemon.mjs — Background scheduler for automatic portal scanning.
 * Reads scan schedule from config/profile.yml and runs scan.mjs on a cron schedule.
 * Usage: node scan-daemon.mjs [--once] [--check]
 */

import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const runOnce = args.includes('--once');
const checkOnly = args.includes('--check');
const PROFILE_PATH = resolve(__dirname, 'config', 'profile.yml');
const SCAN_SCRIPT = resolve(__dirname, 'scan.mjs');
const DAEMON_LOG_PATH = resolve(__dirname, 'data', 'scan-daemon.log');

function loadScanConfig() {
  if (!existsSync(PROFILE_PATH)) { console.error('Error: config/profile.yml not found.'); process.exit(1); }
  const config = yaml.load(readFileSync(PROFILE_PATH, 'utf-8'));
  return config?.auto_scan || {};
}

function parseCronField(field, min, max) {
  if (field === '*') { const v = []; for (let i = min; i <= max; i++) v.push(i); return v; }
  if (field.includes(',')) return field.split(',').flatMap(f => parseCronField(f, min, max));
  if (field.startsWith('*/')) { const step = parseInt(field.slice(2), 10); const v = []; for (let i = min; i <= max; i += step) v.push(i); return v; }
  if (field.includes('-')) { const [s, e] = field.split('-').map(Number); const v = []; for (let i = s; i <= e; i++) v.push(i); return v; }
  return [parseInt(field, 10)];
}

function getNextRunTime(cron) {
  const p = cron.trim().split(/\s+/);
  if (p.length !== 5) return null;
  const [minF, hrF, dayF, monF, dowF] = p;
  const mins = parseCronField(minF, 0, 59), hrs = parseCronField(hrF, 0, 23);
  const days = parseCronField(dayF, 1, 31), mons = parseCronField(monF, 1, 12), dows = parseCronField(dowF, 0, 6);
  const now = new Date(), next = new Date(now);
  for (let d = 0; d <= 7; d++) {
    next.setDate(now.getDate() + d);
    if (!mons.includes(next.getMonth()+1) || !days.includes(next.getDate()) || !dows.includes(next.getDay())) continue;
    for (const hr of hrs) for (const m of mins) { next.setHours(hr, m, 0, 0); if (next > now) return next; }
  }
  return null;
}

function runScan() {
  console.log('[' + new Date().toISOString() + '] Running scheduled scan...');
  try {
    const out = execSync('node "' + SCAN_SCRIPT + '"', { cwd: __dirname, encoding: 'utf-8', timeout: 300000 });
    mkdirSync(dirname(DAEMON_LOG_PATH), { recursive: true });
    appendFileSync(DAEMON_LOG_PATH, '\n' + '='.repeat(60) + '\n' + new Date().toISOString() + '\n' + out + '\n');
    const c = (out.match(/New offers added:\s*(\d+)/) || [])[1];
    if (c && parseInt(c) > 0) { console.log('  Found ' + c + ' new offer(s)'); return parseInt(c); }
    return 0;
  } catch (err) { console.error('  Scan failed: ' + err.message); return -1; }
}

async function sendSlack(url, msg) {
  if (!url) return;
  try { await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({text:msg}) }); } catch {}
}

async function main() {
  const config = loadScanConfig();
  if (checkOnly) {
    console.log('\nAuto-Scan Config:');
    console.log('  Enabled: ' + (config.enabled || false));
    console.log('  Schedule: ' + (config.schedule || '0 8 * * *'));
    const nr = getNextRunTime(config.schedule || '0 8 * * *');
    if (nr) console.log('  Next run: ' + nr.toLocaleString());
    console.log('  Slack: ' + (config.slack_webhook ? 'Yes' : 'No'));
    return;
  }
  if (!config.enabled) { console.log('Auto-scan disabled. Set auto_scan.enabled: true in config/profile.yml'); return; }
  if (runOnce) { const c = runScan(); if (c > 0 && config.slack_webhook) await sendSlack(config.slack_webhook, 'Found ' + c + ' new jobs!'); return; }
  const sched = config.schedule || '0 8 * * *';
  console.log('\nScan Daemon — schedule: ' + sched);
  const nr = getNextRunTime(sched);
  if (nr) console.log('Next run: ' + nr.toLocaleString());
  console.log('Press Ctrl+C to stop.\n');
  let running = true;
  process.on('SIGINT', () => { running = false; });
  while (running) {
    const next = getNextRunTime(sched);
    if (!next) break;
    const wait = next.getTime() - Date.now();
    if (wait > 0) { console.log('Next: ' + next.toLocaleString()); await new Promise(r => setTimeout(r, wait)); }
    if (!running) break;
    const c = runScan();
    if (c > 0 && config.slack_webhook) await sendSlack(config.slack_webhook, 'Found ' + c + ' new jobs!');
  }
  console.log('Daemon stopped.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
