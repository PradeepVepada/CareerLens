#!/usr/bin/env node
/**
 * stories.mjs — Export and review accumulated STAR stories from evaluation reports.
 * Usage: node stories.mjs [--json] [--review] [--company=X]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const reviewMode = args.includes('--review');
const companyFilter = args.find(a => a.startsWith('--company='))?.split('=')[1];
const REPORTS_DIR = resolve(__dirname, 'reports');
const STORY_BANK_PATH = resolve(__dirname, 'interview-prep', 'story-bank.md');
const OUTPUT_DIR = resolve(__dirname, 'output');

function parseStoriesFromReport(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const stories = [];
  const filename = filePath.split(/[/\\]/).pop();
  const companyMatch = filename.match(/\d+-(.+?)-\d{4}/);
  const company = companyMatch ? companyMatch[1].replace(/-/g, ' ') : 'Unknown';
  const blockFMatch = content.match(/## Block F — Interview Plan([\s\S]*?)(?=##|$)/i);
  if (!blockFMatch) return stories;
  const blockF = blockFMatch[1];
  const tableRows = blockF.match(/\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|/g);
  if (!tableRows) return stories;
  for (const row of tableRows.slice(1)) {
    const cells = row.split('|').map(c => c.trim()).filter(c => c);
    if (cells.length >= 7) {
      const [num, jdReq, storyName, s, t, a, r] = cells;
      const reflection = cells[7] || '';
      if (storyName && !storyName.startsWith('JD Req')) {
        stories.push({ company, jdRequirement: jdReq, storyName, situation: s, task: t, action: a, result: r, reflection, source: filename });
      }
    }
  }
  return stories;
}

function collectAllStories() {
  const stories = [];
  if (!existsSync(REPORTS_DIR)) { console.log('No reports directory found.'); return stories; }
  const files = readdirSync(REPORTS_DIR).filter(f => f.endsWith('.md'));
  for (const file of files) { stories.push(...parseStoriesFromReport(resolve(REPORTS_DIR, file))); }
  return stories;
}

function exportMarkdown(stories) {
  const grouped = {};
  for (const story of stories) { const key = story.jdRequirement || 'General'; if (!grouped[key]) grouped[key] = []; grouped[key].push(story); }
  let md = '# STAR Story Bank\n\n';
  md += `Exported from ${stories.length} stories.\n\n`;
  for (const [cat, catStories] of Object.entries(grouped)) {
    md += `## ${cat}\n\n`;
    for (const story of catStories) {
      md += `### ${story.storyName}\n**Company:** ${story.company} | **Source:** ${story.source}\n\n`;
      md += `**S:** ${story.situation}\n\n**T:** ${story.task}\n\n**A:** ${story.action}\n\n**R:** ${story.result}\n\n`;
      if (story.reflection) md += `**Reflection:** ${story.reflection}\n\n`;
      md += '---\n\n';
    }
  }
  return md;
}

async function main() {
  console.log('Collecting STAR stories...\n');
  let stories = collectAllStories();
  if (companyFilter) stories = stories.filter(s => s.company.toLowerCase().includes(companyFilter.toLowerCase()));
  if (stories.length === 0) { console.log('No stories found. Run evaluations with Block F first.'); return; }
  console.log(`Found ${stories.length} stories.\n`);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  if (jsonMode) {
    writeFileSync(resolve(OUTPUT_DIR, 'story-bank.json'), JSON.stringify(stories, null, 2), 'utf-8');
    console.log('JSON exported to output/story-bank.json');
  } else {
    writeFileSync(resolve(OUTPUT_DIR, 'story-bank.md'), exportMarkdown(stories), 'utf-8');
    console.log('Markdown exported to output/story-bank.md');
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
