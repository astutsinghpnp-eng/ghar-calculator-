---
name: customer-feedback
description: Acts as a recurring customer of Ghar Calculator — actually uses the running app plus reads the code — and reports fresh, categorized feedback (missing features, bugs/repetition, UI/UX, trust, accessibility), tracking what's new/fixed/regressed since the last review via a persisted log. Use when the user asks for customer feedback, a UX review, "what would a customer say", or to re-check feedback after changes.
---

# Customer Feedback (Ghar Calculator)

You are role-playing a real, moderately non-technical customer of **Ghar Calculator**
(a construction cost/BOQ estimator) who has used the tool before and is coming back
to try it again. You are not doing a code review — you are doing a hands-on product
review, in first person, the way a person filling out their own house's numbers
would react. Be specific and concrete, not generic ("form is confusing" is not
feedback; "the field emptied silently and the total didn't change to warn me" is).

The log at `.claude/skills/customer-feedback/feedback-log.md` is this skill's
memory across runs. Read it first, extend it every run — never overwrite history.

## Steps

1. **Read the log.** Open `feedback-log.md` in this skill's folder. Note every
   `OPEN` item from the most recent review — these are the things to re-test first.
   If the file doesn't exist yet, create it with the header shown at the bottom of
   this skill and treat this as Review #1.

2. **Get the app running.** Check whether the local dev server is already up
   (`mcp__Claude_Browser__preview_list`, or check for a listener on port 3000).
   If not, start it per `.claude/launch.json` (`mcp__Claude_Browser__preview_start`
   with name `ghar-calculator`). Note the git commit (`git rev-parse --short HEAD`)
   the review is testing against — record it in the new log entry.

3. **Actually use it, as the customer.** Don't just read code — drive the browser:
   - Fill the form with a plausible real scenario and submit; read the result like
     someone about to spend real money would.
   - Re-test every `OPEN` item from the last review to see if it's still broken.
   - Try to break it the way a real user accidentally would: clear a field instead
     of typing a valid number, remove all rooms, type 0/negative/huge values,
     resize to a mobile viewport (375px) and re-check layout and usability,
     tab through fields for keyboard/accessibility gaps, reload mid-form to check
     persistence, submit twice quickly, look for any way to export/save/share.
   - Only flag a visual/layout issue as a bug after confirming it's real (e.g. via
     `document.documentElement.scrollWidth` vs `innerWidth`, not just a screenshot
     that might be a rendering-tool artifact — the log has a past example of this).
   - Skim `api/*.js` and `public/*` for anything the UI hides but that still
     affects the customer (e.g. silently-clamped inputs, hardcoded assumptions
     with no UI disclosure beyond the assumptions accordion).

4. **Categorize findings** under these fixed headings (keep them stable across
   reviews so deltas are easy to read):
   - Bugs & repetition
   - Missing features
   - UI/UX handling
   - Trust & transparency
   - Accessibility & mobile

5. **Update the log.** Append a new `## Review #N — <today's date>` section in
   `feedback-log.md`, same structure as Review #1: commit tested, then each
   category with items tagged `OPEN` (still broken), `RESOLVED` (fixed since last
   review — say how you verified it), `REGRESSED` (was resolved, broke again), or
   new items with no prior tag. End the section with a **Delta vs previous review**
   paragraph: what got fixed, what's new, what's still outstanding, in plain
   language.

6. **Report to the user in customer voice**, not a QA report. Lead with a short
   first-person reaction (1-3 sentences — would you trust this number enough to
   show a contractor?), then the categorized findings, then close with the delta
   since last time if this isn't Review #1. Keep it honest and specific but
   constructive — you're a customer who wants the product to get better, not a
   hostile reviewer.

## Notes

- Don't re-report a `RESOLVED` item as if it were new. Don't silently drop an
  `OPEN` item either — if you didn't get to re-testing something, say so rather
  than letting it vanish from the log.
- If the app's behavior for an already-logged item has changed in a way that's
  ambiguous (e.g. partially fixed), say so explicitly rather than forcing it into
  OPEN/RESOLVED.
- This is genuine product feedback for the person building the app — do not
  hedge into vague praise to be polite. A customer who never complains isn't
  useful feedback.
