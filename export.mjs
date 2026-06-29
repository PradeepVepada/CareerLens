#!/usr/bin/env node

/**
 * export.mjs — Export the application tracker to CSV or Excel.
 *
 * Usage:
 *   node export.mjs              # export to CSV (default)
 *   node export.mjs --format=csv # export to CSV
 *   node export.mjs --format=xlsx # export to Excel (requires xlsx package)
 *   node export.mjs --output=path/to/file.xlsx  # custom output path
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TRACKER_PATH = resolve(__dirname, 'data', 'applications.md');
const DEFAULT_OUTPUT_DIR = resolve(__dirname, 'output');

// ── CLI flags ───────────────────────────────────────────────────────
const args = process.argv.slice(2);
let format = 'csv';
let outputPath = null;

for (const arg of args) {
  if (arg.startsWith('--format=')) {
    format = arg.split('=')[1].toLowerCase();
  } else if (arg.startsWith('--output=')) {
    outputPath = arg.split('=')[1];
  }
}

if (!['csv', 'xlsx'].includes(format)) {
  console.error(`Invalid format "${format}". Use: csv, xlsx`);
  process.exit(1);
}

// ── Parse tracker ───────────────────────────────────────────────────

function parseTracker() {
  if (!existsSync(TRACKER_PATH)) {
    console.error('Error: data/applications.md not found. Run evaluations first.');
    process.exit(1);
  }

  const content = readFileSync(TRACKER_PATH, 'utf-8');
  const lines = content.split('\n');
  
  // Find header row (starts with | #)
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('| #') || lines[i].trim().startsWith('|#')) {
      headerIdx = i;
      break;
    }
  }
  
  if (headerIdx === -1) {
    console.error('Error: Could not find tracker header row in applications.md');
    process.exit(1);
  }

  // Parse header
  const headerLine = lines[headerIdx];
  const headers = headerLine
    .split('|')
    .map(h => h.trim())
    .filter(h => h.length > 0);

  // Parse rows (skip header and separator)
  const rows = [];
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    
    const cells = line
      .split('|')
      .map(c => c.trim())
      .filter(c => c.length > 0 || true);  // Keep empty cells
    
    if (cells.length >= headers.length - 1) {
      rows.push(cells);
    }
  }

  return { headers, rows };
}

// ── CSV export ──────────────────────────────────────────────────────

function exportCSV(headers, rows) {
  const escapeCSV = (cell) => {
    const str = String(cell || '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ];

  return lines.join('\n');
}

// ── Excel export ────────────────────────────────────────────────────

async function exportXLSX(headers, rows) {
  let XLSX;
  try {
    XLSX = await import('xlsx');
  } catch {
    console.error('Error: xlsx package not installed. Run: npm install xlsx');
    console.error('Falling back to CSV export...');
    return null;
  }

  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Main tracker sheet
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  ws['!cols'] = headers.map((h, i) => ({
    wch: Math.max(h.length, ...rows.map(r => String(r[i] || '').length).slice(0, 10)) + 2
  }));

  XLSX.utils.book_append_sheet(wb, ws, 'Applications');

  // Status pivot sheet
  const statusCounts = {};
  const scoreByStatus = {};
  for (const row of rows) {
    const status = row[5] || 'Unknown';  // Status column
    const score = parseFloat(row[4]) || 0;  // Score column
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    if (!scoreByStatus[status]) scoreByStatus[status] = [];
    if (score > 0) scoreByStatus[status].push(score);
  }

  const pivotData = [['Status', 'Count', 'Avg Score']];
  for (const [status, count] of Object.entries(statusCounts)) {
    const scores = scoreByStatus[status] || [];
    const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 'N/A';
    pivotData.push([status, count, avg]);
  }

  const wsPivot = XLSX.utils.aoa_to_sheet(pivotData);
  wsPivot['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsPivot, 'Status Summary');

  // Score distribution sheet
  const scoreDist = [[], []];
  for (let s = 0; s <= 5; s++) {
    scoreDist[0].push(`${s}.0-${s}.9`);
    scoreDist[1].push(0);
  }
  for (const row of rows) {
    const score = parseFloat(row[4]) || 0;
    const bucket = Math.min(Math.floor(score), 4);
    scoreDist[1][bucket]++;
  }
  const scoreData = [['Score Range', 'Count'], ...scoreDist[0].map((range, i) => [range, scoreDist[1][i]])];
  const wsScore = XLSX.utils.aoa_to_sheet(scoreData);
  wsScore['!cols'] = [{ wch: 15 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsScore, 'Score Distribution');

  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('📊 Exporting application tracker...\n');

  const { headers, rows } = parseTracker();
  console.log(`  Found ${rows.length} applications`);

  mkdirSync(DEFAULT_OUTPUT_DIR, { recursive: true });

  if (format === 'csv') {
    const csv = exportCSV(headers, rows);
    const out = outputPath || resolve(DEFAULT_OUTPUT_DIR, 'tracker.csv');
    writeFileSync(out, csv, 'utf-8');
    console.log(`  ✅ CSV exported to ${out}`);
  } else if (format === 'xlsx') {
    const xlsxBuffer = await exportXLSX(headers, rows);
    if (xlsxBuffer) {
      const out = outputPath || resolve(DEFAULT_OUTPUT_DIR, 'tracker.xlsx');
      writeFileSync(out, xlsxBuffer);
      console.log(`  ✅ Excel exported to ${out}`);
      console.log('  📈 Includes: Applications, Status Summary, Score Distribution');
    } else {
      // Fallback to CSV
      const csv = exportCSV(headers, rows);
      const out = outputPath || resolve(DEFAULT_OUTPUT_DIR, 'tracker.csv');
      writeFileSync(out, csv, 'utf-8');
      console.log(`  ✅ CSV fallback exported to ${out}`);
    }
  }
}

main().catch((err) => {
  console.error('Export failed:', err.message);
  process.exit(1);
});
