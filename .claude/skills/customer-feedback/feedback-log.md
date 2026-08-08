# Ghar Calculator — Customer Feedback Log

This file is the memory for the `customer-feedback` skill. Each review appends a
dated section. Never delete history — mark items RESOLVED / REGRESSED / STILL OPEN
instead, so the log shows a trend over time, not just a snapshot.

Status tags used below: `OPEN` (present, not yet fixed), `RESOLVED` (verified fixed
in the review that closed it), `REGRESSED` (was resolved, broke again).

---

## Review #1 — 2026-08-08

Commit at time of review: `4c45d0d` (Rename style.css to public/style.css)
Tested via: local dev server (`node server.js`) on http://localhost:3000, desktop
(730px) and mobile (375px) viewports, plus a read of `api/estimate.js` / `public/*`.

### Bugs & repetition
- `OPEN` **Stale results survive a failed submit.** Remove all rooms/washrooms/
  bathrooms and submit: the "Could not calculate: At least one room, washroom, or
  bathroom is required." banner appears, but the *previous* successful result panel
  (structural summary + itemized table + total) stays fully visible right below it.
  Reads as if the invalid submission still produced a valid, current answer.
  Root cause: `render()`'s `resultPanel.hidden = false` is never re-set to `true`
  on the `.catch()` path in `public/script.js`.
- `OPEN` **Silent default substitution, presented with false precision.** Clearing
  "Plot length" entirely (not typing a bad value, just deleting it) bypasses the
  `min="10"` HTML5 constraint (empty ≠ invalid to the browser), sends `0` to the
  API, and `num()` in `api/estimate.js:62` silently swaps in the hidden fallback
  (30 ft) with zero indication anywhere in the UI. The result still renders as an
  exact, confident rupee total. A typed `-40` *is* caught (native "must be ≥ 10"
  tooltip) — only the empty-field path leaks through.
- `OPEN` **Inconsistent input protection.** `min`/no-`max` exist on some numeric
  fields but there's no upper bound anywhere (e.g. 500 floors would silently
  compute), and no field has `required`, so the empty-field gap in the item above
  applies to every numeric input, not just plot length.

### Repetitive / friction
- `OPEN` **Same 3 example rooms every visit.** `public/script.js` hardcodes
  `addRoomRow(12,10)/(10,8)/(14,12)` on load. Anyone whose house isn't that layout
  deletes/edits 3 rows before they can start, every single session.
- `OPEN` **No persistence.** Refresh or navigate away and the entire form (plot
  size, rooms, doors, washrooms, bathrooms, parking) resets to defaults. A
  15+-field form with no autosave means an accidental reload = redo everything.
- `OPEN` **No scenario save/compare.** Comparing "2 floors" vs "3 floors" or
  swapping door/window presets means re-entering the whole form from scratch —
  there's no duplicate/save-named-scenario path for a tool whose purpose is
  side-by-side decision support.

### Missing features
- `OPEN` **No export.** No PDF/print/share/copy of the estimate — the only way to
  hand this to a contractor is a screenshot of a webpage.
- `OPEN` **No save/load of a named project** ("My house v1").
- `OPEN` **No unit flexibility.** Fine for an India-focused tool (₹, sqft), but
  no sqm toggle and nothing up front (before you scroll to line items) that says
  this is India-priced.
- `OPEN` **No sensitivity/what-if view** on the assumptions the accordion already
  discloses (e.g. steel price +10%) — good transparency, but static.

### UI/UX handling
- `OPEN` **Loading state is invisible.** `statusEl.textContent = 'Calculating…'`
  fires and resolves in the same tick (no real network latency locally, and even
  on Vercel it's a single fast function call) — it flashes and gives no reliable
  "yes, this just recalculated" signal, which compounds the stale-panel bug above.
- `OPEN` **No sticky running total.** The itemized table has ~20 line items across
  3 sections; the number that matters (grand total) is only visible at the very
  top (structural summary has none) or the very bottom — no anchor while scrolling.
- `OPEN` **Error banner is visually weak.** Plain inline text, same weight as a
  form hint, directly above a strongly-styled result panel — easy to miss.

### Trust & transparency
- `OPEN` **No sanity-check on big derived quantities.** e.g. 35,306 bricks for a
  ~936 sqft build is presented with no ₹/sqft or per-sqft-quantity benchmark, so a
  non-engineer customer has no quick way to judge "is this plausible" vs "is this
  a bug" — matters more given item above (silent defaults can quietly skew these).

### Accessibility & mobile
- `OPEN` **No inline field-level errors.** Validation, when it fires at all, is a
  single banner at the top of the results area, not next to the offending field —
  slower to place blame on a long form, worse for screen-reader users who won't
  discover the banner without navigating back to it.
- Checked for a viewport-overflow / dead-space layout bug on mobile (375px) —
  **not reproducible** (`scrollWidth` == `innerWidth` == 375, no horizontal
  overflow); initial screenshot artifact was a rendering-tool scaling quirk, not
  a real CSS bug. Noted here so a future review doesn't re-flag it.

### Delta vs previous review
N/A — first review.

---

## Review #2 — 2026-08-08

Commit at time of review: `4c45d0d` (unchanged since Review #1 — `git diff` against
that commit is empty; only untracked `server.js`/`.claude/` present, same as before).
Tested via: local dev server (`node server.js`) on http://localhost:3000, desktop
(1280px) and mobile (375px) viewports, using direct DOM/network inspection in
addition to clicking through the UI.

### Bugs & repetition
- `OPEN` **Stale results survive a failed submit.** Re-tested: emptied rooms,
  washrooms, and bathrooms, submitted. `#form-status` shows "Could not calculate:
  At least one room, washroom, or bathroom is required." while `#result-panel`
  stays `hidden:false`/`display:block` with the *previous* successful estimate
  still fully rendered underneath. Unchanged from Review #1.
- `OPEN` **Silent default substitution, presented with false precision.** Re-tested:
  cleared `#plotLength` entirely and submitted (with rooms/washrooms otherwise
  valid). Request returned `200 OK` with a complete, confident estimate
  (built-up area 336 sqft, grand total ₹12,62,338) and `#form-status` stayed
  empty — no error, no banner, no indication a required field was blank.
  Unchanged from Review #1.
- `OPEN` **No upper bound on numeric inputs — now confirmed with a concrete
  absurd result.** Set "Number of doors" to 500000 and submitted: no validation
  error, response was `200 OK`, and the UI confidently displayed "Estimated
  total: ₹9,10,11,62,997" (≈910 crore) with zero sanity warning. Same root cause
  as the Review #1 item (no `max`, no `required`), but this run produced a
  concrete, absurd number rather than a hypothetical — worth escalating priority.

### Repetitive / friction
- `OPEN` **No persistence.** Re-tested directly: after submitting an estimate,
  reloading the page resets `plotLength`/`plotWidth`/room count/`totalDoors` etc.
  back to the hardcoded defaults (40/30/3 rooms/6 doors) — confirmed via DOM
  read post-reload. Unchanged from Review #1.
- Not re-tested this pass: "Same 3 example rooms every visit" (no code change,
  so still presumed OPEN by inspection) and "No scenario save/compare" (still no
  duplicate/save affordance found in the DOM's button/link list — see below).

### Missing features
- `OPEN` **No export/save/share.** Full inventory of every button/link on the
  page after a successful calculation: `✕` (remove room) ×3, `+ Add room`,
  `Calculate detailed estimate`. No print/PDF/copy/save/share control exists
  anywhere. Unchanged from Review #1.
- Not re-tested directly this pass, but no code changed: no unit toggle, no
  what-if/sensitivity view — still presumed OPEN.

### UI/UX handling
- `OPEN` **Error banner is visually weak.** Confirmed via computed styles:
  `#form-status` has `class="hint"`, `font-weight:400`, `font-size:12px`, gray
  text (`rgb(85,89,95)`) — literally styled as a form hint, not an error, sitting
  right above the (still-visible, per the bug above) result panel. Unchanged.
- Not re-verified by direct interaction this pass, but no code changed: invisible
  loading state, no sticky running total — still presumed OPEN.

### Trust & transparency
- `OPEN` **No sanity-check on big derived quantities**, now with a sharper
  example: the 500000-doors run above shows the app will render a ~910 crore
  total with the same calm styling as a normal ₹19 lakh result — no plausibility
  guardrail anywhere between "user typo" and "displayed as fact."

### Accessibility & mobile
- Re-checked mobile (375px) after reload: `document.documentElement.scrollWidth`
  (375) still equals `window.innerWidth` (375) — **confirmed no horizontal
  overflow**, consistent with Review #1's conclusion that the earlier screenshot
  artifact was not a real bug.
- Not re-tested this pass: inline field-level errors / screen-reader discovery
  of the banner — still presumed OPEN (banner mechanism unchanged, see UI/UX
  above).
- New observation this pass (tooling note, not a product bug): the Browser
  pane's `computer` screenshot tool rendered what looked like two side-by-side
  copies of the whole form in one capture. Verified via JS
  (`document.querySelectorAll('main').length` = 1, `form` = 1,
  `scrollWidth` ≈ `innerWidth`) that the DOM has only one copy — this was a
  capture-tool artifact, same category as the Review #1 mobile screenshot issue.
  Noted so it isn't mistaken for a real duplicate-render bug in a future review.

### Delta vs previous review
No code changed since Review #1 (`4c45d0d`, confirmed via empty `git diff`), and
every item re-tested behaved identically — nothing RESOLVED, nothing REGRESSED,
nothing new in kind. The one substantive change is evidentiary: the "no max
bound" item now has a concrete reproduction (500000 doors → a ~910 crore total
shown with total confidence) instead of a hypothetical, which raises how urgent
it feels relative to the rest of the OPEN list. Everything else stands exactly
as documented in Review #1.

---

## Review #3 — 2026-08-08

Commit at time of review: `4c45d0d` — still unchanged. `git diff` empty, and
`public/index.html`, `public/script.js`, `public/style.css`, `api/estimate.js`
all show the same on-disk timestamp (2026-08-07 22:20) as before Review #2. This
review was triggered back-to-back with Review #2 with no edits in between, so
it's a **lighter spot-check**, not a full fresh pass — I re-verified the three
highest-signal items directly rather than re-running the entire test matrix.
Anything not explicitly re-tested below should be read as "unchanged, not
re-verified this pass," not as silently dropped.

### Bugs & repetition
- `OPEN` **Stale results survive a failed submit.** Re-tested: submitted a valid
  estimate (total ₹19,42,717), then cleared all rooms + washrooms + bathrooms and
  resubmitted. `#form-status` showed the required-field error while
  `#result-panel` (`hidden:false`) kept displaying the old ₹19,42,717 estimate
  verbatim underneath it — confirmed by string match on the old total. Unchanged.
- Not re-tested this pass (no code change, so presumed unchanged): silent
  default substitution on blank plot length; no upper bound on numeric inputs.

### Repetitive / friction
- `OPEN` **No persistence.** Re-tested: cleared washrooms/rooms, reloaded the
  page — form snapped back to defaults (3 sample rooms, washrooms=1). Unchanged.

### Missing features / UI/UX handling / Trust & transparency / Accessibility & mobile
Not re-tested this pass — no code changed since Review #2's exhaustive check of
these categories, so all items stand exactly as recorded there (export/save
absent, weak error-banner styling, no sanity cap on derived totals, no mobile
overflow at 375px).

### Delta vs previous review
No change. This was a back-to-back re-invocation with zero edits to the app in
between (same commit, same file timestamps as Review #2). The three items
re-verified directly (stale result panel, no persistence) behaved identically to
Review #2. Recommendation: the next review is worth running only after an actual
code change lands — re-testing unchanged code produces no new signal, just log
noise.

### Addendum — same session, prompted by user pushing for deeper coverage
The user asked directly whether the review so far was thorough enough. It
wasn't — I'd only ever tested through the browser form. Two checks I hadn't
done yet, run against the same commit (`4c45d0d`):

- `NEW` **`/api/estimate` has no server-side validation at all — the browser
  form is the only gate.** Called the endpoint directly with `fetch()`,
  bypassing the UI entirely: `plotLength:-40, plotWidth:-30, floors:-5,
  rooms:[{length:-12,width:-10}], totalDoors:-6, totalWindows:-10,
  washrooms:-1, bathrooms:-1, parking:-2`. Response was `200 OK` with a fully
  formed estimate (134 sqft built-up area, priced line items) built from
  all-negative inputs. Since this is a public Vercel serverless function, any
  script (or a buggy future integration) can hit it directly — the `min`
  attributes on the HTML inputs are not a real validation layer, only a UI
  courtesy. This is the same root cause as the "no upper bound" / "silent
  default" items above (no validation in `api/estimate.js`'s `num()` helper),
  but demonstrated at the API layer, which is the layer that actually matters
  for data integrity. Ranks above the frontend-only issues in priority.
- `NEW` **No submit-lock on the button.** Triple-clicked "Calculate detailed
  estimate" rapidly; confirmed via network log that 3 separate POSTs fired
  back-to-back (visible as three `200 OK` calls milliseconds apart). Harmless
  today since the endpoint is stateless and idempotent, but it's a sign the
  button doesn't disable itself while a request is in flight — would matter if
  this ever gains a save/submit-to-database feature.

Still not covered by any review so far, flagged explicitly rather than implied
as fine: keyboard-only tab order and focus management, screen-reader label
correctness (`aria-*`, error announcement), dark-mode/contrast, decimal-value
handling (e.g. `12.5` ft rooms), and whether editing a field after a successful
submit updates the shown result or requires a manual resubmit.

---

## Implementation update — 2026-08-08 (same day, no new review cycle)

Following the `prd-review` skill's shortlist, the following items from Review
#1-#3 and the addendum above were implemented and directly re-verified against
a running server on the same commit base (not yet a new commit — changes are
uncommitted at time of writing):

- `RESOLVED` **Stale results survive a failed submit.** `resultPanel.hidden`
  now gets reset to `true` in the fetch `.catch()` path. Re-verified: DOM check
  after a failed submit shows `hidden: true`.
- `RESOLVED` **Silent default substitution / no server-side validation.** The
  addendum's exact negative-values `fetch()` payload now returns `400` instead
  of `200`. All numeric fields are validated server-side with real min/max
  bounds, independent of the HTML attributes.
- `RESOLVED` **Inconsistent input protection / no upper bound.** The 500000-doors
  repro now returns `400 — "Number of doors must be at most 60."` instead of a
  ~910 crore total. `required` and `max` were also added to the HTML inputs as
  a first line of defense, but the real fix is server-side.
- `RESOLVED` **No persistence.** Form state now autosaves to `localStorage` on
  every change and restores on load. Re-verified with an actual reload
  (`navigate`, not a soft refresh) — including a room list that had been
  emptied out, which correctly stayed empty rather than reverting to the 3
  hardcoded starter rooms.
- `RESOLVED` **No export.** Added a "Copy summary" button (clipboard) and a
  "Print / Save as PDF" button with a dedicated print stylesheet. Not a full
  PDF generator, but closes the "only option is a screenshot" gap.
- `RESOLVED` **Error banner is visually weak.** `#form-status` now gets an
  `.error` class (distinct red/bordered treatment) on failure, confirmed via
  `className` after a failed submit — previously indistinguishable from a
  plain form hint.
- `RESOLVED` **No submit-lock on the button.** Triple-clicking now produces
  exactly one network request (verified via network log), not three — the
  button disables itself for the duration of the in-flight request.
- `RESOLVED` **No sanity-check on big derived quantities.** The Brickwork line
  now shows a live per-sqft benchmark ("~37.7 bricks/sqft — typical range is
  30–40, so this looks normal") computed from the actual result, not a static
  disclaimer.
- `PARTIALLY RESOLVED` **Loading state is invisible.** Not directly addressed
  by this pass, but the new submit-lock means the button visibly changes state
  (disabled) for the duration of the request, which gives *some* signal where
  there was none before. The underlying "Calculating…" text still resolves
  too fast to notice on a local/fast connection — not a full fix.
- `NEW (by design)` **Single total replaced with a range.** Not a bug fix but
  a direct response to the "false precision" trust concern raised across
  reviews: the headline now reads as a range (±8%) with a reference midpoint,
  computed server-side.

**Still open — same 3 example rooms, no scenario save/compare, no unit
toggle, no sticky running total, no inline field-level errors, and the full
accessibility gap (keyboard/screen-reader) noted above.** None of these were
in scope for this implementation pass; they weren't part of the `prd-review`
shortlist that drove it. Next full `customer-feedback` review should re-drive
the app hands-on (not just re-check via DOM/network calls, which is what this
update used) to catch anything this pass missed or introduced.
