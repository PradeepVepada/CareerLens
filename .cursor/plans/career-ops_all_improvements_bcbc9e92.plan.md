---
name: Career-Ops All Improvements
overview: Implement all 12 improvements from career-ops-improvements.md across config, Node.js scripts, and AI prompt modes. Organized in 3 phases by priority.
todos:
  - id: p1-visa
    content: "Phase 1: Visa sponsorship filter — profile.example.yml + portals.example.yml + scan.mjs + oferta.md"
    status: completed
  - id: p1-dedup
    content: "Phase 1: Dedup enhancement — --allow-duplicates flag + verbose logging in scan.mjs"
    status: completed
  - id: p1-score
    content: "Phase 1: Score transparency — scoring_weights in profile.example.yml + weighted table in oferta.md"
    status: completed
  - id: p1-pdf
    content: "Phase 1: Resume version tracking — deterministic naming + auto pdf-index in generate-pdf.mjs"
    status: completed
  - id: p2-setup
    content: "Phase 2: setup.mjs interactive onboarding wizard + package.json script"
    status: completed
  - id: p2-export
    content: "Phase 2: export.mjs CSV/Excel tracker export + package.json + install xlsx dep"
    status: completed
  - id: p2-daemon
    content: "Phase 2: scan-daemon.mjs auto-scan scheduler + package.json + install node-schedule dep"
    status: completed
  - id: p3-stories
    content: "Phase 3: stories.mjs story bank export + package.json"
    status: completed
  - id: p3-cache
    content: "Phase 3: cache.mjs + modes/deep.md company research caching"
    status: completed
  - id: p3-variants
    content: "Phase 3: cv-variants.example.yml + --variant flag in generate-pdf.mjs"
    status: completed
  - id: p3-apply
    content: "Phase 3: modes/apply.md dry-run + error recovery"
    status: completed
  - id: p3-negotiation
    content: "Phase 3: Salary negotiation tracker columns + modes/tracker.md outcomes"
    status: completed
isProject: false
---

# Career-Ops: All 12 Improvements Implementation Plan

## Current State Assessment

- **Dedup already works** in `scan.mjs` (lines 900–998) — it logs "Duplicates: N skipped". Improvement = add `--allow-duplicates` flag + verbose per-job logging.
- **PDF indexing already works** via `--report` flag in `generate-pdf.mjs` + `data/pdf-index.tsv`. Improvement = deterministic naming + auto-populate.
- **Doctor check** shows system is not yet onboarded (all 4 user-layer files missing).

---

## Phase 1 — Critical/High Priority

### 1. Visa Sponsorship Filter
Files to change:
- `config/profile.example.yml` — add `visa.needs_sponsorship: true` and `visa.citizenship_required_blocklist: ["US citizens only", "green card"]`
- `templates/portals.example.yml` — add `sponsors_visa: true/false/unknown` field to each company entry
- `scan.mjs` — add sponsorship filter: if `needs_sponsorship: true` and company `sponsors_visa: false`, skip with counter; also filter JD content for citizenship/green card phrases via `content_filter`
- `modes/oferta.md` — add "Sponsorship Status" row to Block A table; add warning gate before Block A if profile requires sponsorship and JD contains citizenship-only language

### 2. Duplicate Detection (Enhancement)
File to change:
- `scan.mjs` — add `--allow-duplicates` CLI flag; upgrade logging to print skipped job titles per company (e.g. "⏭️  Acme: skipped 2 dupes — Senior Engineer (seen 2026-06-20), Staff Engineer (seen 2026-06-18)")

### 3. Score Transparency
Files to change:
- `config/profile.example.yml` — add `scoring_weights` block:
  ```yaml
  scoring_weights:
    cv_match: 25
    seniority_fit: 20
    compensation: 15
    growth_potential: 15
    culture_signals: 15
    geo_lifestyle: 10
  ```
- `modes/oferta.md` — replace current A–F prose scoring with an explicit weighted scoring table at the end of Block B. Output format:
  ```
  | Dimension | Score | Weight | Contribution |
  |-----------|-------|--------|--------------|
  | CV Match  | 4.2/5 | 25%    | 1.05         |
  ...
  | **Final** |       |        | **3.9/5**    |
  ```
  Add reasoning snippet for each sub-score.

### 4. Resume Version Tracking
File to change:
- `generate-pdf.mjs` — change default output name from `output/*.pdf` to `output/{company-slug}_{role-slug}_{YYYY-MM-DD}.pdf`; auto-populate `data/pdf-index.tsv` with columns: `num | filename | company | role | date | cv_version | hash`
- `modes/oferta.md` / `modes/pdf.md` — instruct the agent to use `--report={num}` flag so the tracker linkage is written automatically

---

## Phase 2 — Medium Priority

### 5. Cold Start Onboarding Wizard
New file: `setup.mjs`
- Interactive Node.js script using built-in `readline` (no extra deps)
- Steps: name/email/location → target roles → STAR accomplishments (3–5 prompts) → salary/visa → generates `config/profile.yml` + skeleton `cv.md`
- Add `"setup": "node setup.mjs"` to `package.json`

### 6. CSV / Excel Export
New file: `export.mjs`
- Parses `data/applications.md` markdown table → outputs `output/tracker.csv` (built-in) and optionally `output/tracker.xlsx` (using `xlsx` npm package)
- Color-coded scores, pivot by status
- Add `"export:csv"`, `"export:excel"` to `package.json`; install `xlsx` dep

### 7. Auto-Scan Daemon
New file: `scan-daemon.mjs`
- Uses `node-schedule` npm package for cron scheduling
- Reads `auto_scan.schedule` from `config/profile.yml`
- On new matches, appends to `data/new-matches.md` and optionally POSTs to Slack webhook
- Add `"scan:daemon"` to `package.json`; install `node-schedule` dep

---

## Phase 3 — Low Priority

### 8. Story Bank Export
New file: `stories.mjs`
- Reads `interview-prep/story-bank.md`, groups by behavioral question type, exports to `output/story-bank.md` (print-ready) and `output/story-bank.json`
- Add `"stories": "node stories.mjs"` to `package.json`

### 9. Company Research Caching
Files to change:
- `modes/deep.md` — add cache check at top: read `data/companies-cache.json`, skip research if company present and `researched_date` < 30 days; after research, write result to cache
- New utility: `cache.mjs` with `npm run cache:clear` script

### 10. CV Variants / A/B Testing
Files to change:
- New template: `templates/cv-variants.example.yml` — defines `variants[].name`, `.file`, `.description`
- `generate-pdf.mjs` — add `--variant=<name>` flag that loads `cv-{name}.md` instead of `cv.md`
- `config/profile.example.yml` — add reference to variants config

### 11. Form Auto-Fill Recovery
File to change:
- `modes/apply.md` — add `--dry-run` mode that lists fields + proposed values before executing; add explicit fallback prompt when a field can't be auto-filled; add instruction to store filled values in tracker notes

### 12. Salary Negotiation Tracker
Files to change:
- `modes/oferta.md` — add negotiation outcome section placeholder after Block G
- `templates/states.yml` / `data/applications.md` schema — document new optional columns: `offer_amount`, `negotiation_outcome`
- New mode stub: `/career-ops outcomes` documented in `modes/tracker.md`

---

## How to Launch career-ops

career-ops is **not a web app** — it's an AI agent pipeline that runs inside your AI coding assistant (Claude Code, Cursor, Codex, etc.).

**Quick start (3 steps):**
1. Open this project in Cursor (already done) and start a new chat
2. Say "run career-ops setup" — the agent will run `node doctor.mjs --json` and walk you through onboarding (CV, profile, portals)
3. Paste any job URL or JD text into chat — the agent auto-evaluates it

**For the automated scanner:**
```bash
node setup.mjs          # first-time onboarding wizard (new — Phase 2)
npm run scan            # scan all portals for new jobs (zero AI tokens)
npm run scan:daemon     # background auto-scan on schedule (new — Phase 2)
```

**For the Go TUI dashboard** (optional, requires Go installed):
```bash
cd dashboard && go run .
```

**Key commands inside AI chat:**
- Paste a JD URL → auto full evaluation (A–G blocks + PDF)
- `/career-ops scan` → scan portals
- `/career-ops tracker` → application status
- `/career-ops pdf {company}` → generate/regenerate PDF
- `/career-ops patterns` → rejection analysis

---

## File Change Summary

| File | Type | Change |
|------|------|--------|
| `config/profile.example.yml` | Edit | Add sponsorship, scoring_weights, auto_scan |
| `templates/portals.example.yml` | Edit | Add sponsors_visa per company |
| `modes/oferta.md` | Edit | Sponsorship gate + scoring table |
| `scan.mjs` | Edit | Sponsorship filter + --allow-duplicates |
| `generate-pdf.mjs` | Edit | Deterministic naming + --variant flag |
| `setup.mjs` | New | Interactive onboarding wizard |
| `export.mjs` | New | CSV/Excel tracker export |
| `scan-daemon.mjs` | New | Scheduled auto-scan |
| `stories.mjs` | New | Story bank export |
| `cache.mjs` | New | Company research cache manager |
| `templates/cv-variants.example.yml` | New | A/B testing template |
| `modes/apply.md` | Edit | Dry-run + error recovery |
| `modes/deep.md` | Edit | Cache check/write |
| `modes/tracker.md` | Edit | Document outcomes command |
| `package.json` | Edit | Add new scripts + deps (xlsx, node-schedule) |
