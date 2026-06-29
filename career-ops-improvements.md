# Career-Ops Improvement Roadmap
## Major Problems & Feature Requests (Based on Medium Review)

---

## 1. VISA SPONSORSHIP FILTER (CRITICAL)

**Problem Statement:**
Career-ops evaluates and generates tailored CVs for companies that have never sponsored visas, with zero awareness of visa requirements. For international job seekers (a significant population), this results in wasted effort on roles that are impossible to pursue.

**Current Behavior:**
- Evaluation scoring treats a sponsored-eligible role and a non-sponsored role identically
- No flag, filter, or warning in the scanner output
- No check against company sponsorship history
- Users must manually add sponsorship context to `_shared.md` and hope Claude picks it up

**Desired Behavior:**
- [ ] Add `sponsors_visa: true/false` field to `portals.yml` config per company
- [ ] Add sponsorship requirement input to `config/profile.yml` (e.g., `needs_sponsorship: true`)
- [ ] Modify `modes/oferta.md` evaluation to check sponsorship flag before scoring
- [ ] Add "Sponsorship Status" row to evaluation output (e.g., "❌ No visa sponsorship" in red, or "✅ Known sponsor")
- [ ] There is no must that all jobs have to sponsor but if they do it would be great else not an issue but omit jobs asking for citizenship and green card status.
- [ ] Store sponsorship status in tracker (TSV column)

**Impact:**
Prevents hours of evaluation and PDF generation for roles that are DOA for visa-requiring candidates.

**Implementation Notes:**
- Sponsorship data can be partially pre-populated from public sources (LinkedIn, Levels.fyi, Blind, etc.)
- Should also allow users to mark companies they've confirmed don't sponsor
- Consider adding a "sponsorship confidence level" (verified, assumed, unknown)

---

## 2. COLD START ONBOARDING (HIGH FRICTION)

**Problem Statement:**
The system requires 2–3 hours of writing before first useful evaluation: `cv.md`, `profile.yml`, `_shared.md`, `article-digest.md`. The README acknowledges this ("think of it as onboarding a new recruiter") but doesn't provide scaffolding to reduce friction. New users hit diminishing returns on evaluation quality early.

**Current Behavior:**
- `config/profile.example.yml` is sparse template with minimal guidance
- No interactive setup wizard or questions to build context files
- No auto-import from LinkedIn, GitHub, or other sources
- Early evaluations are generic because Claude doesn't know the user yet
- No guide on "what context matters most, in what order"

**Desired Behavior:**
- [ ] Add interactive CLI setup (`npm run setup` or `/career-ops setup`) that walks user through:
  - Name, role target(s), seniority level
  - Key accomplishments (prompts for 3–5 STAR stories)
  - Geographic/salary constraints
  - Visa requirements, remote preferences
  - Tech stack focus areas
- [ ] Auto-generate initial `cv.md` from user's input (not just a blank template)
- [ ] Auto-generate initial `profile.yml` with sensible defaults
- [ ] Provide "minimum viable profile" that gives 80% evaluation quality with 30 min effort
- [ ] Rank context by impact ("Most important: recent wins and CV," vs. "Nice-to-have: proof points")
- [ ] Add examples in `config/` that show real context files (anonymized)

**Impact:**
Reduces barrier to entry from 2–3 hours to 30 minutes, and results are immediately better.

**Implementation Notes:**
- Use `inquirer.js` or similar for interactive prompts
- Could validate inputs (e.g., make sure CV has at least 3 roles)
- Store responses to allow easy re-running of setup

---

## 3. DUPLICATE JOB DETECTION (PIPELINE LEAKAGE)

**Problem Statement:**
Running the scanner on consecutive days produces duplicate job listings. The `dedup-tracker.mjs` script exists but requires manual invocation — it's not woven into the automated pipeline. Users re-evaluate the same job tomorrow unless they remember to run a separate script.

**Current Behavior:**
- `scan.mjs` fetches all jobs from ATS APIs each run
- No automatic dedup before adding to `pipeline.md`
- Users must manually run `npm run dedup` after each scan
- Same job URL can appear multiple times in pipeline if scanner is run multiple times

**Desired Behavior:**
- [ ] Integrate dedup logic directly into `scan.mjs` pipeline
- [ ] Check incoming job URLs against existing `tracker.md` (already applied/rejected) and `pipeline.md` (pending)
- [ ] Skip jobs that were evaluated in the last N days (configurable, e.g., 7 days)
- [ ] Log deduplicated jobs to console ("Skipped 3 duplicates from yesterday's run")
- [ ] Make dedup configurable: `--allow-duplicates` flag to re-evaluate if needed
- [ ] Store job URL + evaluation date in tracker so future runs have reference

**Impact:**
Pipeline stays clean, no wasted evaluation cycles, scanner output is immediately actionable.

**Implementation Notes:**
- Use job URL + company as dedup key (most reliable)
- Could also track job title + company + salary range as secondary key (for jobs that move portals)
- Dedup should happen *before* the verification step (Playwright liveness check)

---

## 4. SCORING TRANSPARENCY & CONSISTENCY (BLACK BOX PROBLEM)

**Problem Statement:**
A–F grades are generated by Claude reasoning alone, with no visible weights or criteria audit trail. Two runs of the same JD can produce different grades. Users can't tune importance of individual factors (e.g., "I care twice as much about technical depth as location").

**Current Behavior:**
- Scoring logic lives in `modes/oferta.md` as prose instructions to Claude
- Claude produces A–F grade as subjective reasoning output
- Grade can vary between runs due to LLM stochasticity
- No way to inspect "why did this job get a 3.5 vs a 4.2?"
- No user-tunable weights for different dimensions

**Desired Behavior:**
- [ ] Refactor scoring into explicit, visible components:
  - CV Match (weight: X%)
  - Seniority Fit (weight: X%)
  - Compensation Research (weight: X%)
  - Growth Potential (weight: X%)
  - Team/Culture Signals (weight: X%)
  - Geographic/Lifestyle Fit (weight: X%)
- [ ] Output scoring table showing sub-scores and weights:
  ```
  | Dimension | Score | Weight | Contribution |
  |-----------|-------|--------|---------------|
  | CV Match | 4.2/5 | 25% | 1.05 |
  | Seniority | 3.8/5 | 20% | 0.76 |
  ...
  | **Final** | | | **3.9/5** |
  ```
- [ ] Make weights user-configurable in `config/profile.yml`
- [ ] Add determinism: use temperature=0 for consistent scores
- [ ] Include reasoning snippets for each sub-score ("CV Match: Strong on Python, weak on Rust")
- [ ] Store weights in tracker for reproducibility

**Impact:**
Users understand why a job scored what it did. Can tune system to their preferences. Debugging bad scores becomes possible.

**Implementation Notes:**
- Move scoring logic from prose to structured JSON schema
- Claude can still reason about sub-scores, but output them as structured data
- Could store historical scores for same job to detect drift
- Weights could be per-user, per-archetype, or per-search campaign

---

## 5. RESUME VERSION TRACKING (LOST CONTEXT)

**Problem Statement:**
You generate 100 tailored CVs. A recruiter calls about a role you applied to 3 weeks ago — but which version of your CV did they see? Career-ops generates PDFs but doesn't link them back to tracker rows. No way to know which resume variant was sent to which company.

**Current Behavior:**
- CVs generated via `/career-ops pdf` or auto-pipeline create files in `output/` with generic names
- Tracker entry (TSV) has no `pdf_filename` or `cv_version` field
- User manually manages which PDF went with which application
- If you apply to the same company twice (different roles), you can't tell which CV variant was used
- Recruiting call: "We're interested in your profile" — which profile?
- Needed make use of this local MCP at C:\Users\vprad\Den\Jobs\resume_make

**Desired Behavior:**
- [ ] Generate PDF with deterministic naming: `output/{company}_{role_slug}_{timestamp}.pdf` or `output/{tracker_id}.pdf`
- [ ] Add column to tracker: `pdf_generated` (filename or path)
- [ ] Add column to tracker: `cv_version` (e.g., "v1", "v2_with_rag_projects", "stripped_biomedical")
- [ ] When generating PDF via pipeline, automatically populate the tracker column
- [ ] Add `/career-ops pdf-link {tracker_id}` to find and display the PDF that was sent
- [ ] Store hash of generated PDF content to detect accidental overwrites
- [ ] Add note field to tracker for annotating CV changes mid-search (e.g., "Updated AgentIQ section after feedback")

**Impact:**
When a recruiter calls, you know exactly what version of yourself they saw. Can iterate on CV positioning without losing history.

**Implementation Notes:**
- Tracker ID should be stable (use row index or UUID)
- Could also add "CV tweaks for this role" as a separate column (short text)
- Consider storing a git-like diff log of CV changes between versions

---

## 6. DATA PORTABILITY & SHAREABILITY (EXCEL vs. TSV)

**Problem Statement:**
Everything lives in TSV (tab-separated values) files and markdown tables. Fine for developers. Friction for anyone who wants to share their pipeline with a mentor, open it on their phone, filter/sort in Excel, or back it up to Google Drive. TSV doesn't have formatting, charts, or easy filtering.

**Current Behavior:**
- Tracker stored as `data/tracker.tsv`
- No native Excel output
- Users can open TSV in Excel but formatting is lost on save
- Mentor/friend can't easily review the pipeline without cloning the repo
- No way to do quick pivot tables or conditional formatting
- Mobile access requires terminal + Node + Claude Code

**Desired Behavior:**
- [ ] Add `npm run export:excel` that generates `tracker.xlsx` with:
  - Tracker data in one sheet
  - Application counts by company in another sheet (pivot)
  - Score distribution chart (histogram of grades)
  - Status breakdown pie chart
  - Color-coded scores (red < 3.0, yellow 3.0–3.9, green 4.0+)
- [ ] Add `npm run export:google-sheets` to push tracker to Google Sheets (read-only or editable)
- [ ] Add CSV export option (simpler than XLSX, still spreadsheet-friendly)
- [ ] Keep markdown table in sync with TSV for documentation
- [ ] Add `npm run share` to generate a shareable link (e.g., GitHub Gist with sanitized tracker)

**Impact:**
Career mentor can review your pipeline in Excel. You can share progress without asking them to clone the repo. Backup/archival is trivial.

**Implementation Notes:**
- Use `xlsx` library to generate Excel with formatting
- Google Sheets integration requires OAuth setup (optional)
- CSV is low-hanging fruit, do that first
- Could add data validation (e.g., status field only allows valid states)

---

## 7. DAILY AUTO-SCAN WITHOUT MANUAL TRIGGER (WORKFLOW GAP)

**Problem Statement:**
The scanner is powerful but requires manual invocation (`npm run scan` or `/career-ops scan`). Users miss new listings that appear between manual runs. The tool is reactive, not proactive.

**Current Behavior:**
- Scanner runs only when explicitly invoked
- Users must remember to run it (lazy, easily forgotten)
- New jobs posted overnight are only discovered if user runs scan first thing
- No alerting when new matches appear
- No way to set cadence (e.g., "scan every morning at 8am")

**Desired Behavior:**
- [ ] Add optional background scheduler (cron or Node.js `node-schedule`)
- [ ] Config option in `profile.yml`: `auto_scan: { enabled: true, schedule: "0 8 * * *" }`
- [ ] When scheduled scan finds new jobs, log them to a "new jobs since last check" file
- [ ] Optional webhook/Slack notification on new matches above threshold score (e.g., "5 new jobs scored 4.0+")
- [ ] Add `npm run scan:daemon` to run scanner in background
- [ ] Add `npm run scan:once` for manual one-off scans
- [ ] Store last scan timestamp per company, skip companies scanned in last X hours

**Impact:**
Never miss a new listing. Pipeline stays fresh. Users get proactive, not reactive.

**Implementation Notes:**
- Could use AWS Lambda or GitHub Actions for scheduled runs (serverless alternative)
- Slack integration uses webhook (user configures in profile)
- Daemon mode needs graceful shutdown handling
- Store scan history to avoid ATS rate-limit issues

---

## 8. RESUME VERSION BRANCHING FOR A/B TESTING

**Problem Statement:**
Users want to test different CV positioning strategies (e.g., "emphasize ML projects" vs. "emphasize infrastructure") without manually maintaining multiple files. Currently, there's one `cv.md` and every generated PDF derives from it.

**Current Behavior:**
- Single `cv.md` is the source of truth
- All generated CVs are variants of the same base
- Testing different positioning requires manually editing `cv.md` and regenerating
- No way to A/B test two CV strategies across similar roles

**Desired Behavior:**
- [ ] Add `cv.variants.yml` config:
  ```yaml
  variants:
    - name: "ml-focus"
      description: "Emphasize ML/LLM projects"
      file: "cv-ml.md"
    - name: "infra-focus"
      description: "Emphasize systems/scaling"
      file: "cv-infra.md"
    - name: "default"
      file: "cv.md"
  ```
- [ ] Add `--variant={name}` flag to PDF generation: `/career-ops pdf --variant=ml-focus`
- [ ] Add `variant_used` column to tracker
- [ ] When generating PDFs in batch mode, allow specifying which variant to use per role
- [ ] Track which variant got better response rates (interviews, callbacks)

**Impact:**
Users can scientifically test CV strategies without guesswork.

**Implementation Notes:**
- Variants should be stored in a subdirectory like `cv-variants/`
- Could auto-detect variants by scanning for `cv-*.md` files
- Metrics tracking requires collecting interview/callback data (requires user input)

---

## 9. INTERVIEW STORY BANK EXPORT & REVIEW

**Problem Statement:**
The story bank accumulates STAR+Reflection stories but is opaque. Users can't easily review, edit, or export stories to prepare offline or share with a coach.

**Current Behavior:**
- Stories are stored inline in evaluation reports (`reports/*.md`)
- No centralized story registry
- Stories are tagged to behavioral questions but not browseable
- No way to export for interview prep (e.g., to a PDF or note app)
- Can't rank stories by relevance or quality

**Desired Behavior:**
- [ ] Add `/career-ops stories` command that exports all accumulated STAR stories to:
  - Markdown file grouped by behavioral question type
  - JSON for programmatic use
  - PDF for printing/sharing
- [ ] Add story review interface: list all stories, mark as "strong", "needs work", "archive"
- [ ] Add `stories/` directory with curated story files (user-editable)
- [ ] Add `/career-ops story-add {question}` to manually add a new story
- [ ] Tag stories by company/domain ("Anthropic loves scaling stories", "Retool loves user focus")
- [ ] Add story quality heuristic (Claude scores each story 1–5, flags weak ones)

**Impact:**
Interview prep becomes a by-product of job search, not extra work.

**Implementation Notes:**
- Parse existing reports to extract STAR stories automatically
- Use NLP to cluster similar stories
- Could use Claude to suggest which stories to practice most

---

## 10. COMPANY RESEARCH CACHING (AVOID DUPLICATE RESEARCH)

**Problem Statement:**
If you apply to Google for two different roles, `/career-ops deep` runs independent company research twice, duplicating effort and API calls.

**Current Behavior:**
- Company research is per-evaluation, not shared
- No cache of "we already researched Company X"
- Deep research can be slow (multiple web searches, document fetches)

**Desired Behavior:**
- [ ] Add `data/companies-cache.json` that stores researched companies:
  ```json
  {
    "anthropic": {
      "researched_date": "2026-06-20",
      "growth_trajectory": "...",
      "team_profile": "...",
      "culture_signals": "...",
      "ttl_days": 30
    }
  }
  ```
- [ ] Check cache before running research; only refresh if older than 30 days
- [ ] Add `npm run cache:clear` to reset
- [ ] Add `/career-ops deep --force` to bypass cache

**Impact:**
Faster evaluations when applying to same company twice. Lower API usage.

**Implementation Notes:**
- Cache key should be normalized company name
- Company research can be expensive (multiple web searches), so this saves real time
- Could extend to role-based research caching

---

## 11. APPLICATION FORM AUTO-FILL FAILURES & RECOVERY

**Problem Statement:**
The `/career-ops apply` mode tries to fill application forms with AI, but form structures vary wildly. Failures are silent or unclear, and there's no recovery mechanism.

**Current Behavior:**
- Playwright-based form filling works for common patterns (text, select, radio)
- Custom form layouts often fail silently
- No clear error messages when a field can't be found or filled
- No fallback if auto-fill fails partway through
- No way to manually correct and re-submit

**Desired Behavior:**
- [ ] Add explicit error logging when form field detection fails
- [ ] Add `/career-ops apply {url} --dry-run` to preview actions before executing
- [ ] If auto-fill fails, fall back to interactive mode: "I found field 'desired salary' but couldn't auto-fill. What do you want to enter?"
- [ ] Add form template definitions for common platforms (Ashby, Greenhouse form variants)
- [ ] Store filled form data in tracker (for recovery if submission fails)
- [ ] Add `/career-ops apply {id} --resume {variant}` to reapply with different resume

**Impact:**
Form filling becomes reliable, not a gamble.

**Implementation Notes:**
- Form debugging is hard; could use Playwright's `screenshot()` to help diagnose failures
- Store form field locations for later reference (speedup on repeated platforms)

---

## 12. SALARY NEGOTIATION TRACKER & OUTCOMES

**Problem Statement:**
Career-ops generates negotiation scripts but doesn't track what actually happened — which offers you received, what you negotiated, what you accepted.

**Current Behavior:**
- `/career-ops negotiation` generates scripts but no follow-up tracking
- No way to record actual offer received vs. generated script predictions
- No outcome tracking (accepted, rejected, negotiated → final)
- Can't measure system accuracy over time

**Desired Behavior:**
- [ ] Add `/career-ops offer-received {tracker_id} {salary} {details}` to log actual offer
- [ ] Add `/career-ops negotiate {tracker_id}` to generate and refine negotiation script based on actual offer
- [ ] Add `offer_received`, `offer_amount`, `offer_details`, `negotiation_outcome` columns to tracker
- [ ] Add `/career-ops outcomes` to show:
  - Offers received vs. pipeline size (conversion rate)
  - Salary outcomes vs. compensation research predictions
  - Which evaluation factors predicted successful offers
- [ ] Add `/career-ops best-practices` to extract learnings from successful roles (what made that 4.8/5 job actually close?)

**Impact:**
Feedback loop: see what the system got right/wrong, iterate on evaluation criteria.

**Implementation Notes:**
- Salary tracking can be sensitive; consider encryption or privacy flags
- Could compare predicted vs. actual comp to calibrate compensation research
- Success patterns emerge after 10–15 offers tracked

---

## SUMMARY OF PRIORITIES

| Problem | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Visa Sponsorship Filter | High | Medium | **CRITICAL** |
| Duplicate Detection | High | Low | **HIGH** |
| Score Transparency | High | High | **HIGH** |
| Resume Version Tracking | Medium | Low | **HIGH** |
| Cold Start Onboarding | High | Medium | **MEDIUM** |
| Excel Export | Medium | Low | **MEDIUM** |
| Auto-Scan Daemon | Medium | Medium | **MEDIUM** |
| Story Bank Export | Medium | Medium | **LOW** |
| Company Research Cache | Low | Low | **LOW** |
| Form Auto-Fill Recovery | Medium | High | **LOW** |
| Salary Negotiation Tracker | Medium | High | **LOW** |
| Resume A/B Testing | Low | Medium | **LOW** |

---

## IMPLEMENTATION SUGGESTIONS

**Phase 1 (Do First):**
- Visa sponsorship filter
- Duplicate detection auto-fix
- Score transparency table
- Resume version tracking

**Phase 2 (Quick Wins):**
- Excel/CSV export
- Cold start setup wizard
- Story bank export

**Phase 3 (Nice-to-Have):**
- Auto-scan daemon
- Company research caching
- A/B testing variants
- Negotiation outcome tracking

---

## NOTES FOR AI PROMPT

When asking an AI to implement these:

1. **Be specific**: Include the example YAML, TSV columns, or UI designs (provided above)
2. **Reference current code**: Ask it to modify `scan.mjs`, `modes/oferta.md`, `tracker.mjs`, etc. by name
3. **Link to existing patterns**: "Use the same PDF generation pipeline as `generate-pdf.mjs`" or "Follow the pattern in `dedup-tracker.mjs`"
4. **Ask for tests**: Request unit tests or integration tests, especially for dedup and scoring
5. **Backwards compatibility**: Ask it to handle existing `tracker.tsv` files without breaking them

Good prompt template:
```
I want to add [feature name] to career-ops. Here are the problems:
[Copy relevant section from this doc]

Looking at the codebase, I think this should:
1. Modify [file] to add [change]
2. Add new [file] for [function]
3. Update tracker schema to include [column]

Can you implement this with tests?
```
