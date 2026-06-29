# Mode: tracker — Applications Tracker

Read and display `data/applications.md`.

**Tracker Format:**

```markdown
| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
```

Possible states: `Evaluated` → `Applied` → `Responded` → `Interview` → `Offer` / `Rejected` / `Discarded` / `SKIP`

- `Evaluated` = offer evaluated with report, pending decision
- `Applied` = the candidate submitted their application
- `Responded` = Company has responded (not yet interview)
- `Interview` = active interview process
- `Offer` = job offer received
- `Rejected` = rejected by company
- `Discarded` = discarded by candidate or offer closed
- `SKIP` = doesn't fit, don't apply

If the user asks to update a state, edit the corresponding row.

Also show statistics:
- Total applications
- Breakdown by state
- Average score
- % with PDF generated
- % with report generated

## Outcomes Command

When the user asks about outcomes or salary negotiation tracking:

### Offer Tracking

If the user says "I received an offer" or "offer received":
1. Ask for the tracker row number or company name
2. Ask for offer details: salary, bonus, equity, sign-on, start date
3. Update the tracker row status to `Offer`
4. Add a notes entry: "Offer: $X total comp (base: $X, bonus: $X, equity: $X)"
5. Store in the report file under `## Offer Details`

### Negotiation Tracking

If the user says "I negotiated" or "counter-offer":
1. Ask for the tracker row number or company name
2. Ask what was negotiated and the outcome
3. Add a notes entry: "Negotiated: [what] → [outcome]"
4. Store in the report file under `## Negotiation Log`

### Outcomes Analysis

When the user asks "show outcomes" or "what's my conversion rate":
- Calculate: offers received / total applications = conversion rate
- Calculate: interviews / applications = interview rate
- Show average score of offers vs. rejections
- Show which evaluation factors predicted successful offers
- Compare predicted compensation (Block D) vs. actual offers

### Best Practices Extraction

When the user asks "what worked" or "best practices":
- Identify patterns in successful roles (high-scoring offers)
- Extract common themes from top-scoring evaluations
- Note which proof points appeared most in interview-stage roles
- Suggest which CV sections to emphasize based on success patterns
