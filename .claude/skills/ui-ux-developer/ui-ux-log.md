# Ghar Calculator — UI/UX Log

This file is the memory for the `ui-ux-developer` skill (renamed and rewritten
from `ui-ux-review` on 2026-08-08 — same log, broader mandate: full redesign
authority, not just fixing measurable issues in the existing system). Each
entry appends a dated section. Never delete history — mark items `SHIPPED` /
`DROPPED` instead, so the log shows a trend over time, not just a snapshot.

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

---

## Redesign #1 — 2026-08-08

Skill renamed `ui-ux-review` → `ui-ux-developer` and rewritten with a broader
mandate: the user asked for an actual redesign — font sizes, colors, fonts,
overall feel — not another pass fixing issues in the existing system.

### Direction: "Warm brick & steel"

The old system (navy blueprint grid, cool cyan, Space Grotesk) read as an
architect's technical drawing — precise, but cold for a tool a homeowner uses
to plan their own house, not an engineer's working document. New direction
draws on the actual materials of the job instead of an arbitrary palette:

- **Color** (6 named values, all in `public/style.css` `:root`):
  `--navy` repurposed to warm charcoal `#2A2018` (anchor/structural),
  `--amber` repurposed to brick red `#C1502E` (the accent that does the
  "catch the eye" work — the primary CTA, focus states, corner brackets),
  `--amber-deep` `#93381E` (hover), `--cyan` repurposed to warm gold
  `#E4B876` (text on the dark hero), `--paper` warm off-white `#FAF4EA`,
  `--error` shifted to a distinct crimson `#A4342A` so it never reads as the
  same color as the brand accent. Variable *names* kept stable so every
  existing usage site repainted automatically instead of needing a
  find-and-replace across the CSS.
- **Type**: display headings moved from Space Grotesk to **Zilla Slab**
  (bold, 600/700) — a slab serif was chosen specifically because its blocky
  letterforms read as "construction/brick" the way a delicate literary serif
  wouldn't, which sidesteps the generic warm-cream-plus-serif combination
  that's become the default AI-generated-design look, while still being
  genuinely warm. Body stayed Inter, data/labels stayed IBM Plex Mono — both
  were already doing their job, no reason to change them.
- **Motif**: the hero's blueprint grid became a running-bond brick pattern
  (encoded inline SVG, exact offset second course), the one deliberate
  "does this look redesigned" moment rather than changing hex values
  everywhere and calling it done.
- **Everything else**: card radius 4px → 10px, buttons/inputs → 6-8px, soft
  shadows added to panels for depth, the primary CTA switched from charcoal
  to brick with bumped size/weight since it's the one element whose whole
  job is to catch the eye first.

### Verification
- Computed real contrast ratios on the new palette for 18 element/state
  pairs. Found and fixed one real failure: the skip-link was charcoal text
  on brick background at 3.38:1 (fails the 4.5:1 minimum) — switched to the
  same charcoal-bg/white-text treatment used elsewhere, now 15.93:1.
  Everything else cleared 4.5:1+ on first pass, including the ones closest
  to the edge: submit button white-on-brick at 4.71:1, error banner 5.63:1,
  field-error text 6.77:1, compare table labels 6.35:1.
- Confirmed `document.fonts` shows Zilla Slab 600/700 (the weights actually
  used) as `loaded`, and `h1`'s computed `font-family` resolves to it — not
  silently falling back to a system serif.
- Mobile (375px): `scrollWidth` still equals `innerWidth`, no overflow
  introduced by the redesign.
- Touch targets unaffected: remove-room button still measures 44×44px.
- Console and server logs: no errors.
- **Not verified this round**: could not get a compositing screenshot (the
  Browser pane wasn't displaying frames this session) — verification here is
  entirely computed-value-based, which is real evidence but isn't the same
  as a human or an AI actually looking at the rendered page. Flagging this
  rather than claiming a visual check that didn't happen.

### Note for future runs of this skill
Any earlier `ui-ux-review` finding about a *specific color value* (not a
structural pattern) no longer applies as stated, since the palette itself
changed — re-verify against the new values rather than assuming an old fix
still holds.
