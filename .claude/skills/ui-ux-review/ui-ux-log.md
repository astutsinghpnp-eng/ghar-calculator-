# Ghar Calculator — UI/UX Review Log

This file is the memory for the `ui-ux-review` skill. Each review appends a
dated section. Never delete history — mark items `SHIPPED` / `DROPPED` instead,
so the log shows a trend over time, not just a snapshot.

Status tags: `OPEN`, `SHIPPED` (verified fixed — say how), `DROPPED` (still
true, deliberately not fixed — say why).

---

## Review #1 — 2026-08-08

Reviewed against: commit `4c45d0d` base + the uncommitted validation/autosave/
range/compare/accessibility work from earlier today. Method: read
`public/style.css` for the existing design system first, then drove the live
app at desktop and 375px mobile widths, pulling computed styles and real
`getBoundingClientRect()` measurements rather than eyeballing screenshots.

### Findings

1. `SHIPPED` **"Compare Scenarios" heading was nearly unreadable.**
   Measured: `rgb(143,193,227)` (the `--cyan` token) on a white panel
   background — roughly 2:1 contrast, against a 4.5:1 WCAG AA minimum. Root
   cause: `.eyebrow`'s default color is tuned for the dark navy hero, and the
   only override (`.result-panel .eyebrow`) didn't cover the new
   `.compare-panel`, which shares the same white `.panel` background. Fixed
   the pattern, not the instance: changed the selector to `.panel .eyebrow`
   so any current or future white-background panel is covered. Re-measured
   after the fix: `rgb(85,89,95)` (`--graphite`) on white — the same
   already-proven-legible color used for every other label and hint in the
   app.
2. `SHIPPED` **Bricks/sqft plausibility note wrapped awkwardly, right-aligned.**
   It's a sentence, but it sat in a table cell matched by `td:last-child {
   text-align: right; font-weight: 500 }`, meant for right-aligned numeric
   values, not prose. Fixed with an explicit left-align + normal-weight
   override scoped to `.benchmark-note`.
3. `SHIPPED` **"Remove room" button was under the mobile tap-target minimum.**
   Measured at 28×28px; accepted minimum is ~44×44px (WCAG 2.5.5). Resized to
   44×44 and widened the room-row's third grid column to match. Re-measured
   post-fix: 44×44 confirmed.
4. `SHIPPED` **Four result-action buttons had no visual grouping.** "Copy
   summary," "Print," "Save as Scenario A," and "Save as Scenario B" — two
   unrelated actions (export vs. compare) rendered as one undifferentiated
   row, worse on mobile where they stacked into four identical full-width
   buttons. Split into two labeled groups ("Export" / "Compare") with a small
   uppercase mono label above each.
5. `SHIPPED` **Comparison table cramped on a 375px screen.** Row labels and
   values were wrapping onto two lines more than necessary. Added a
   `max-width: 480px` rule tightening the grid columns and reducing font
   size slightly. Verified no horizontal overflow before or after
   (`scrollWidth` == `clientWidth` on the grid both times) — this was a
   density/legibility issue, not a real overflow bug.
6. `SHIPPED` **Hero's eyebrow and the new unit-disclosure line looked like
   near-duplicates.** Both were IBM Plex Mono, uppercase-adjacent, similar
   cyan — read as repetitive rather than as a label plus a footnote. Gave the
   disclosure line its own quieter treatment: Inter instead of mono, a more
   muted color, no letter-spacing — visually subordinate to the eyebrow now.

### Considered, not changed
- **Sticky total bar stays visible even past the compare-panel section.**
  Debated whether to scope it to hide once the user scrolls into
  `#compare-panel`, but decided the total is still relevant context while
  comparing scenarios — leaving as-is rather than adding scope-narrowing
  complexity for a borderline call.

### Delta vs previous review
N/A — first review.

---

## Review #2 — 2026-08-08 (same day)

The user asked directly whether Review #1 was thorough enough. It wasn't a
complete audit — it was scoped to what surfaced while testing the compare
panel and mobile layout. This pass went back and actually checked the things
a first pass skips: computed a real WCAG contrast ratio for every text/
background combination I could find (14 resting-state pairs, plus the error
banner, skip-link, sticky bar, and disabled button), not just the one that
happened to be broken.

### Findings
- **Contrast audit: everything else was already clean.** All 14 resting-state
  pairs came back between 6.28:1 and 17.4:1, comfortably above the 4.5:1 AA
  minimum. The error banner (4.92:1) and field-error text pass but are the
  closest margins in the app — worth knowing if the error red or its
  background ever shifts.
7. `SHIPPED` **The total was buried at the bottom of a 20-row table.** On
   first view, before the sticky bar has anything to react to, there was no
   way to see the headline number without scrolling past the entire
   itemized breakdown. Added a preview total (amber-bordered callout) right
   after the structural summary, before the itemized table — the full total
   and reference figure still appear again at the natural end of the
   arithmetic, so this is a preview, not a replacement. Verified via
   screenshot: appears immediately after "Footing size," reads clearly,
   sticky bar still works independently underneath.
8. `SHIPPED` **Loading state had no motion — just a color change.** Added a
   spinner (CSS `::after` + `@keyframes`, respects `prefers-reduced-motion`)
   that replaces the button label while a request is in flight. Verified by
   checking the `.loading` class and computed styles synchronously right
   after a valid submit (before the fetch resolves) — confirmed present, then
   confirmed cleanly removed after.

### Considered, not changed
- **Two inline `style="margin-top:..."` attributes in `index.html`.** Pure
  code hygiene — invisible to a user, not a rendering inconsistency. Not
  worth a diff for zero visible improvement, but noted here in case a future
  pass wants to convert them to classes while touching that area anyway.
- **Native number-input spinner arrows** (the up/down stepper) — appearance
  varies by browser and wasn't testable cross-browser in this environment.
  Flagged as unverified rather than silently assumed fine.

### Delta vs previous review
Two new fixes (7, 8), both shipped. Confirmed nothing from Review #1
regressed. The honest answer to "is this enough": items 1-8 are genuinely
fixed and verified. Cross-browser rendering and a full screen-reader pass
(as opposed to DOM/ARIA structure checks) remain unverified — flagged, not
silently assumed done.
