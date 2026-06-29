#!/usr/bin/env node

/**
 * setup.mjs — Interactive onboarding wizard for career-ops.
 *
 * Guides new users through creating their profile, CV, and portal config.
 * Reduces cold-start friction from 2-3 hours to ~30 minutes.
 *
 * Usage:
 *   node setup.mjs              # full interactive setup
 *   node setup.mjs --minimal    # skip optional steps (CV, STAR stories)
 *   node setup.mjs --check      # check what's already set up
 */

import { createInterface } from 'readline';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI flags ───────────────────────────────────────────────────────
const args = process.argv.slice(2);
const minimal = args.includes('--minimal');
const checkOnly = args.includes('--check');

// ── File paths ──────────────────────────────────────────────────────
const PROFILE_PATH = resolve(__dirname, 'config', 'profile.yml');
const PROFILE_EXAMPLE = resolve(__dirname, 'config', 'profile.example.yml');
const PORTALS_PATH = resolve(__dirname, 'portals.yml');
const PORTALS_EXAMPLE = resolve(__dirname, 'templates', 'portals.example.yml');
const CV_PATH = resolve(__dirname, 'cv.md');
const PROFILE_MD_PATH = resolve(__dirname, 'modes', '_profile.md');
const PROFILE_MD_TEMPLATE = resolve(__dirname, 'modes', '_profile.template.md');
const CUSTOM_MD_PATH = resolve(__dirname, 'modes', '_custom.md');
const CUSTOM_MD_TEMPLATE = resolve(__dirname, 'modes', '_custom.template.md');
const DATA_DIR = resolve(__dirname, 'data');
const TRACKER_PATH = resolve(DATA_DIR, 'applications.md');
const PIPELINE_PATH = resolve(DATA_DIR, 'pipeline.md');

// ── Helpers ─────────────────────────────────────────────────────────

function createReadline() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl, question, defaultValue = '') {
  return new Promise((resolve) => {
    const suffix = defaultValue ? ` [${defaultValue}]` : '';
    rl.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

function askYesNo(rl, question, defaultYes = true) {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  return new Promise((resolve) => {
    rl.question(`${question} (${hint}): `, (answer) => {
      const lower = answer.trim().toLowerCase();
      if (!lower) return resolve(defaultYes);
      resolve(lower === 'y' || lower === 'yes');
    });
  });
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function statusIcon(exists) {
  return exists ? '✅' : '❌';
}

// ── Check mode ──────────────────────────────────────────────────────

function runCheck() {
  console.log('\n📋 Setup Status Check\n');
  const items = [
    ['config/profile.yml', existsSync(PROFILE_PATH)],
    ['cv.md', existsSync(CV_PATH)],
    ['portals.yml', existsSync(PORTALS_PATH)],
    ['modes/_profile.md', existsSync(PROFILE_MD_PATH)],
    ['modes/_custom.md', existsSync(CUSTOM_MD_PATH)],
    ['data/applications.md', existsSync(TRACKER_PATH)],
    ['data/pipeline.md', existsSync(PIPELINE_PATH)],
  ];

  for (const [file, exists] of items) {
    console.log(`  ${statusIcon(exists)} ${file}`);
  }

  const missing = items.filter(([, exists]) => !exists).map(([file]) => file);
  if (missing.length === 0) {
    console.log('\n✨ Everything is set up! You can start evaluating jobs.');
  } else {
    console.log(`\n⚠️  ${missing.length} file(s) missing. Run "node setup.mjs" to complete onboarding.`);
  }
  return missing.length === 0;
}

// ── Profile setup ───────────────────────────────────────────────────

async function setupProfile(rl) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Step 1: Your Profile');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Start from example template
  let profile;
  if (existsSync(PROFILE_PATH)) {
    console.log('  Found existing config/profile.yml — will update it.\n');
    profile = yaml.load(readFileSync(PROFILE_PATH, 'utf-8')) || {};
  } else if (existsSync(PROFILE_EXAMPLE)) {
    profile = yaml.load(readFileSync(PROFILE_EXAMPLE, 'utf-8')) || {};
  } else {
    profile = {};
  }

  // Ensure nested objects exist
  if (!profile.candidate) profile.candidate = {};
  if (!profile.target_roles) profile.target_roles = {};
  if (!profile.narrative) profile.narrative = {};
  if (!profile.compensation) profile.compensation = {};
  if (!profile.location) profile.location = {};
  if (!profile.visa) profile.visa = {};
  if (!profile.scoring_weights) profile.scoring_weights = {};

  // Candidate info
  console.log('  — Candidate Information —\n');
  profile.candidate.full_name = await ask(rl, '  Full name', profile.candidate.full_name || '');
  profile.candidate.email = await ask(rl, '  Email', profile.candidate.email || '');
  profile.candidate.location = await ask(rl, '  Location (city, country)', profile.candidate.location || '');

  // Target roles
  console.log('\n  — Target Roles —\n');
  const rolesInput = await ask(rl, '  Target roles (comma-separated)', 
    (profile.target_roles.primary || []).join(', '));
  profile.target_roles.primary = rolesInput.split(',').map(r => r.trim()).filter(Boolean);

  // Seniority
  const seniority = await ask(rl, '  Seniority level (e.g., Senior, Staff, Principal)', 'Senior');
  
  // Archetypes
  console.log('\n  Common archetypes: AI/ML Engineer, AI Product Manager, Solutions Architect,');
  console.log('  Forward Deployed Engineer, AI Transformation Lead, Platform Engineer\n');
  const archetypesInput = await ask(rl, '  Archetypes (comma-separated)', 'AI/ML Engineer');
  profile.target_roles.archetypes = archetypesInput.split(',').map(a => ({
    name: a.trim(),
    level: seniority,
    fit: 'primary',
  })).filter(a => a.name);

  // Narrative
  console.log('\n  — Your Story —\n');
  profile.narrative.headline = await ask(rl, '  Professional headline (1 line)', profile.narrative.headline || '');
  profile.narrative.exit_story = await ask(rl, '  Exit story (what makes you unique)', profile.narrative.exit_story || '');

  const superpowersInput = await ask(rl, '  Top 3-5 superpowers (comma-separated)', 
    (profile.narrative.superpowers || []).join(', '));
  profile.narrative.superpowers = superpowersInput.split(',').map(s => s.trim()).filter(Boolean);

  // Compensation
  console.log('\n  — Compensation —\n');
  profile.compensation.target_range = await ask(rl, '  Target total comp range (e.g., $150K-200K)', profile.compensation.target_range || '');
  profile.compensation.currency = await ask(rl, '  Currency', profile.compensation.currency || 'USD');
  profile.compensation.minimum = await ask(rl, '  Walk-away number', profile.compensation.minimum || '');

  // Location
  console.log('\n  — Location & Visa —\n');
  profile.location.country = await ask(rl, '  Country', profile.location.country || '');
  profile.location.city = await ask(rl, '  City', profile.location.city || '');
  profile.location.timezone = await ask(rl, '  Timezone', profile.location.timezone || '');

  // Visa
  profile.visa.needs_sponsorship = await askYesNo(rl, '  Do you need visa sponsorship?', false);

  // Scoring weights
  console.log('\n  — Scoring Weights (0-100, must sum to 100) —\n');
  console.log('  Default: cv_match=25, seniority_fit=20, compensation=15,');
  console.log('           growth_potential=15, culture_signals=15, geo_lifestyle=10\n');
  
  const useCustomWeights = await askYesNo(rl, '  Customize scoring weights?', false);
  if (useCustomWeights) {
    profile.scoring_weights.cv_match = parseInt(await ask(rl, '    CV Match weight', '25'), 10);
    profile.scoring_weights.seniority_fit = parseInt(await ask(rl, '    Seniority Fit weight', '20'), 10);
    profile.scoring_weights.compensation = parseInt(await ask(rl, '    Compensation weight', '15'), 10);
    profile.scoring_weights.growth_potential = parseInt(await ask(rl, '    Growth Potential weight', '15'), 10);
    profile.scoring_weights.culture_signals = parseInt(await ask(rl, '    Culture Signals weight', '15'), 10);
    profile.scoring_weights.geo_lifestyle = parseInt(await ask(rl, '    Geo/Lifestyle weight', '10'), 10);
  } else {
    profile.scoring_weights = { cv_match: 25, seniority_fit: 20, compensation: 15, growth_potential: 15, culture_signals: 15, geo_lifestyle: 10 };
  }

  // Write profile
  ensureDir(PROFILE_PATH);
  const header = `# Career-Ops Profile Configuration\n# Generated by setup.mjs on ${new Date().toISOString().slice(0, 10)}\n# This is the single source of truth for your personal data across all modes.\n\n`;
  writeFileSync(PROFILE_PATH, header + yaml.dump(profile, { lineWidth: 120 }), 'utf-8');
  console.log('\n  ✅ Profile saved to config/profile.yml');
  return profile;
}

// ── CV setup ────────────────────────────────────────────────────────

async function setupCV(rl) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Step 2: Your CV');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (existsSync(CV_PATH)) {
    console.log('  ✅ cv.md already exists — skipping.\n');
    return;
  }

  console.log('  Your CV is the source of truth for all evaluations and PDF generation.');
  console.log('  Options:\n');
  console.log('    1. Paste your CV content (markdown format)');
  console.log('    2. Generate a skeleton CV from your profile');
  console.log('    3. Skip for now (you can add cv.md later)\n');

  const choice = await ask(rl, '  Choose (1/2/3)', '2');

  if (choice === '1') {
    console.log('\n  Paste your CV content below (markdown format).');
    console.log('  When done, type "---END---" on a new line:\n');
    
    const lines = [];
    const rl2 = createReadline();
    await new Promise((resolve) => {
      rl2.on('line', (line) => {
        if (line.trim() === '---END---') {
          rl2.close();
          resolve();
        } else {
          lines.push(line);
        }
      });
    });
    
    ensureDir(CV_PATH);
    writeFileSync(CV_PATH, lines.join('\n'), 'utf-8');
    console.log('\n  ✅ CV saved to cv.md');
  } else if (choice === '2') {
    // Generate skeleton from profile
    const profile = yaml.load(readFileSync(PROFILE_PATH, 'utf-8')) || {};
    const name = profile.candidate?.full_name || 'Your Name';
    const headline = profile.narrative?.headline || 'Your professional headline';
    const superpowers = (profile.narrative?.superpowers || []).map(s => `- ${s}`).join('\n');
    const roles = (profile.target_roles?.primary || []).join(', ');

    const skeleton = `# ${name}

## Summary

${headline}

Targeting: ${roles}

## Experience

### [Your Current Role] — [Company Name]
*[Start Date] – Present*

- [Achievement 1 with metric]
- [Achievement 2 with metric]
- [Achievement 3 with metric]

### [Previous Role] — [Company Name]
*[Start Date] – [End Date]*

- [Achievement 1 with metric]
- [Achievement 2 with metric]

## Projects

### [Project Name]
- [What it does]
- [Impact/metric]

## Education

### [Degree] — [University]
*[Year]*

## Skills

${superpowers || '- [Skill 1]\n- [Skill 2]\n- [Skill 3]'}

## Certifications

- [Any relevant certifications]
`;

    ensureDir(CV_PATH);
    writeFileSync(CV_PATH, skeleton, 'utf-8');
    console.log('  ✅ Skeleton CV saved to cv.md');
    console.log('  📝 Edit cv.md with your real experience. The system generates better evaluations with more detail.');
  } else {
    console.log('\n  ⏭️  Skipping CV setup. Add cv.md manually before running evaluations.');
  }
}

// ── Portals setup ───────────────────────────────────────────────────

async function setupPortals(rl, profile) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Step 3: Job Scanner Config');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (existsSync(PORTALS_PATH)) {
    console.log('  ✅ portals.yml already exists — skipping.\n');
    return;
  }

  if (!existsSync(PORTALS_EXAMPLE)) {
    console.log('  ⚠️  templates/portals.example.yml not found. Skipping portal setup.');
    return;
  }

  // Copy example portals
  copyFileSync(PORTALS_EXAMPLE, PORTALS_PATH);
  console.log('  ✅ Copied templates/portals.yml with 45+ pre-configured companies.\n');

  // Update title filter based on target roles
  if (profile?.target_roles?.primary?.length > 0) {
    const roles = profile.target_roles.primary;
    console.log(`  📝 Recommended: Update title_filter.positive in portals.yml to match your target roles:`);
    console.log(`     ${roles.join(', ')}\n`);
  }

  // Ask about location filter
  const customizeLocation = await askYesNo(rl, '  Set up location filter now?', false);
  if (customizeLocation && profile?.location?.country) {
    console.log(`\n  Detected country: ${profile.location.country}`);
    const locationYaml = `\nlocation_filter:\n  allow:\n    - "${profile.location.country}"\n    - "Remote"\n`;
    // Append to portals.yml (simple approach — user can fine-tune later)
    const existing = readFileSync(PORTALS_PATH, 'utf-8');
    const insertPoint = existing.indexOf('# location_filter:');
    if (insertPoint !== -1) {
      const updated = existing.slice(0, insertPoint) + locationYaml + existing.slice(insertPoint);
      writeFileSync(PORTALS_PATH, updated, 'utf-8');
    }
    console.log('  ✅ Location filter added to portals.yml');
  }
}

// ── Data dir setup ──────────────────────────────────────────────────

function setupDataDir() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Step 4: Data Directory');
  console.log('═══════════════════════════════════════════════════════════\n');

  mkdirSync(DATA_DIR, { recursive: true });

  if (!existsSync(TRACKER_PATH)) {
    const header = `# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|------|-------|--------|-----|--------|-------|
`;
    writeFileSync(TRACKER_PATH, header, 'utf-8');
    console.log('  ✅ Created data/applications.md');
  } else {
    console.log('  ✅ data/applications.md already exists');
  }

  if (!existsSync(PIPELINE_PATH)) {
    writeFileSync(PIPELINE_PATH, '# Pipeline\n\n- [ ] Pending jobs will appear here after scanning\n', 'utf-8');
    console.log('  ✅ Created data/pipeline.md');
  } else {
    console.log('  ✅ data/pipeline.md already exists');
  }
}

// ── Profile.md setup ────────────────────────────────────────────────

function setupProfileMd() {
  if (!existsSync(PROFILE_MD_PATH) && existsSync(PROFILE_MD_TEMPLATE)) {
    copyFileSync(PROFILE_MD_TEMPLATE, PROFILE_MD_PATH);
    console.log('  ✅ Copied modes/_profile.md from template');
  }
  if (!existsSync(CUSTOM_MD_PATH) && existsSync(CUSTOM_MD_TEMPLATE)) {
    copyFileSync(CUSTOM_MD_TEMPLATE, CUSTOM_MD_PATH);
    console.log('  ✅ Copied modes/_custom.md from template');
  }
}

// ── STAR stories (optional) ─────────────────────────────────────────

async function setupSTAR(rl) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Step 5: STAR Stories (Optional)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const addStories = await askYesNo(rl, '  Add 3-5 STAR stories now? (helps interview prep)', false);
  if (!addStories) {
    console.log('  ⏭️  Skipping. You can add stories later via interview-prep/story-bank.md\n');
    return;
  }

  const storyBankPath = resolve(__dirname, 'interview-prep', 'story-bank.md');
  mkdirSync(dirname(storyBankPath), { recursive: true });

  const stories = [];
  for (let i = 1; i <= 5; i++) {
    console.log(`\n  — Story ${i} —`);
    const question = await ask(rl, '  What question does this answer? (e.g., "Tell me about a time you led a project")');
    if (!question) break;

    const situation = await ask(rl, '  Situation (1-2 sentences)');
    const task = await ask(rl, '  Task (your specific responsibility)');
    const action = await ask(rl, '  Action (what you did)');
    const result = await ask(rl, '  Result (quantified if possible)');
    const reflection = await ask(rl, '  Reflection (what you learned)');

    stories.push(`### ${question}\n\n**S:** ${situation}\n**T:** ${task}\n**A:** ${action}\n**R:** ${result}\n**Reflection:** ${reflection}\n`);
  }

  if (stories.length > 0) {
    const content = `# Story Bank\n\nAccumulated STAR+Reflection stories for interview preparation.\n\n${stories.join('\n---\n\n')}\n`;
    writeFileSync(storyBankPath, content, 'utf-8');
    console.log(`\n  ✅ Saved ${stories.length} story/stories to interview-prep/story-bank.md`);
  }
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  if (checkOnly) {
    runCheck();
    return;
  }

  console.log('\n🚀 Career-Ops Setup Wizard');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  This wizard will set up your job search pipeline in ~5 minutes.');
  console.log('  All files are saved to the project root and can be edited later.\n');

  const rl = createReadline();

  try {
    // Step 1: Profile
    const profile = await setupProfile(rl);

    // Step 2: CV (unless minimal)
    if (!minimal) {
      await setupCV(rl);
    } else {
      console.log('\n  ⏭️  Skipping CV (minimal mode)');
    }

    // Step 3: Portals
    await setupPortals(rl, profile);

    // Step 4: Data dir
    setupDataDir();

    // Step 5: Profile.md and Custom.md
    setupProfileMd();

    // Step 6: STAR stories (unless minimal)
    if (!minimal) {
      await setupSTAR(rl);
    } else {
      console.log('\n  ⏭️  Skipping STAR stories (minimal mode)');
    }

    // Final summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✅ Setup Complete!');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('  You can now:');
    console.log('    • Paste a job URL to evaluate it');
    console.log('    • Run "node scan.mjs" to search portals');
    console.log('    • Run "node doctor.mjs" to verify setup\n');
    console.log('  Edit these files to refine your profile:');
    console.log('    • config/profile.yml  — your targeting and comp goals');
    console.log('    • cv.md               — your resume (source of truth)');
    console.log('    • modes/_profile.md   — archetype mapping and narrative');
    console.log('    • portals.yml         — which companies to scan\n');
    console.log('  Tip: Having a personal portfolio improves evaluation quality.');
    console.log('  The author\'s portfolio is open source: github.com/santifer/cv-santiago\n');

  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
