# Ghar Calculator — PRD Review Log

This file is the memory for the `prd-review` skill. Each run appends a dated
shortlist. Never delete history — mark items `SHIPPED` / `DROPPED` instead, so
the log shows a trend over time, not just a snapshot.

Status tags: `OPEN` (not yet done), `SHIPPED` (verified done, closed out),
`DROPPED` (still true, deliberately deprioritized — reason given).

---

## Shortlist #1 — 2026-08-08

Reviewed against: commit `4c45d0d`. Input signal: `customer-feedback` log
(Reviews #1-#3 + addendum, same commit), plus direct source reading
(`api/estimate.js`, `public/script.js`, `server.js`) and a direct `fetch()`
call to `/api/estimate` bypassing the UI.

### The shortlist

1. `OPEN` **Put real validation in `api/estimate.js`, not just HTML `min` attributes.**
   Confirmed directly: a raw POST with `plotLength:-40, floors:-5,
   rooms:[{length:-12,width:-10}]` returns `200 OK` with a fully priced
   estimate. This is the single highest-leverage fix on the list — it's the
   root cause behind three separate symptoms customer-feedback logged
   separately (negative values accepted, no upper bound on inputs, blank
   fields silently defaulted). One guard clause, hours of work, closes three
   tickets at once.
2. `OPEN` **Stop rendering a stale result under a failed-submit error.**
   `resultPanel.hidden` never gets reset on the `.catch()` path, so a rejected
   submission still shows the previous total as if it were current. Ships same
   day as #1 — it's a one-line fix, and until it's fixed, every other
   trust-related improvement on this list is undermined by the app visibly
   lying about which number is live.
3. `OPEN` **Autosave the form (`localStorage`), no backend needed.**
   Right now a reload wipes all 15+ fields. Cheap, no architecture change, and
   it structurally reduces the pain of item 6 below (hardcoded sample rooms
   stop mattering once a returning user sees their own last layout instead of
   a stranger's).
4. `OPEN` **Ship *some* export path — print stylesheet or "copy summary" is enough to start.**
   The stated use case is deciding what to build and discussing it with a
   contractor; right now the only way to hand this to someone else is a
   screenshot. This is the biggest gap between "the tool works" and "the tool
   is usable for its actual job," which is why it outranks polish items even
   though it costs more than a one-liner.
5. `OPEN` **Reframe the total as a range, not a single rupee figure.**
   This is the strategic move, not just a fix: "₹18.5L–₹21L" instead of
   "₹19,42,717" quietly defuses the false-precision problem at the model
   level, rather than needing perfect input policing to hold everywhere
   downstream. Costs more design thought than items 1-4, which is why it's
   sequenced after the cheap wins, not before them.
6. `OPEN` **Bundle the remaining polish items into one pass: error-banner styling, a plausibility hint next to big derived quantities (bricks/sqft), and a submit-lock on the button.**
   Individually minor, but they're small enough to do in one sitting once 1-5
   are done, and doing them together avoids three separate small PRs for
   things that all touch the same result-panel/status area.

### Cut from the shortlist — and why

- **Named scenario save/compare** (e.g. "2 floors vs 3 floors" side by side).
  Real idea, but it's downstream of item 5 (range-based estimates) — comparing
  two point estimates is less useful than comparing two ranges, so this
  belongs in the *next* shortlist, not this one.
- **Accessibility (keyboard nav, screen-reader labels).** Not on the list
  because it hasn't been measured yet, not because it doesn't matter — ranking
  it against measured items would be guessing. Needs its own scoping pass
  (an actual keyboard-only and screen-reader run-through) before it can be
  prioritized honestly.

### Delta vs previous shortlist
N/A — first shortlist.

---

## Shortlist #2 — 2026-08-08

Reviewed against: commit `4c45d0d` — unchanged since Shortlist #1 (same commit,
`git diff` empty). Same six findings, same order — nothing new to investigate.

The only real change this round: the user said Shortlist #1 was too jargon-heavy
("root cause," "sequencing," "trust boundary," "model level") and hard to
follow. Rewrote the skill itself (see `SKILL.md` step 5) to always deliver in
plain, everyday language from now on, and rewrote this shortlist accordingly —
see the chat response for the plain-language version. Content/priority order is
identical to Shortlist #1; only the wording changed.

### Delta vs previous shortlist
No new findings, no reordering. Delivery language fixed per user feedback —
this is now the default going forward, not a one-off.

---

## Implementation update — 2026-08-08 (same day)

The user asked to implement the shortlist directly rather than wait for another
review cycle. All six items were built and verified against a live server on
this same commit base. Marking status here so the next `/prd-review` run
doesn't re-flag these as open:

1. `SHIPPED` **Server-side validation.** Verified by re-running the exact
   exploit from Shortlist #1: the same negative-values POST now returns `400`
   with `"Number of floors must be at least 1."` instead of `200`.
2. `SHIPPED` **Stale result panel.** Verified: submitting an invalid form now
   leaves `#result-panel` `hidden: true` — confirmed via direct DOM check, not
   just visually.
3. `SHIPPED` **Autosave.** Verified: filled the form, reloaded the page
   (`navigate`, not a soft refresh), fields and room rows came back exactly as
   left, including a deliberately-emptied room list (didn't fall back to
   defaults).
4. `SHIPPED` **Export path.** Shipped as a "Copy summary" button (clipboard)
   plus a "Print / Save as PDF" button with a dedicated print stylesheet that
   hides the form and shows only the result. Copy-to-clipboard couldn't be
   fully verified end-to-end in the automated browser (clipboard API needs a
   focused real tab), but the failure path was verified to degrade gracefully
   with a clear on-screen message rather than failing silently.
5. `SHIPPED` **Range instead of a single total.** Verified: the headline now
   reads "Estimated total: ₹X – ₹Y" with a reference midpoint line underneath,
   both computed server-side (`grandTotalLow`/`grandTotalHigh`, ±8%).
6. `SHIPPED` **Polish bundle.** All three verified: error banner now gets a
   distinct `.error` style (confirmed via `className`), a submit-lock stops a
   triple-click from firing more than one request (confirmed via network log —
   1 request, not 3), and a bricks/sqft plausibility note now renders under
   the Brickwork line ("~37.7 bricks/sqft — typical range is 30–40, so this
   looks normal.").

**Still open, unchanged:** named scenario compare and accessibility — neither
was in scope for this pass; both remain flagged in prior shortlists as needing
their own work before they can be prioritized.

---

## Implementation update #2 — 2026-08-08 (same day)

The user asked to fix everything still open, including the two items
deliberately deferred above plus three more from the underlying
`customer-feedback` log that were never on a shortlist at all (unit
disclosure, sticky total, inline field errors). All five built and verified
live:

7. `SHIPPED` **Scenario compare.** Added "Save as Scenario A / B" buttons and
   a comparison table (floors, built-up area, cement, steel, bricks, total
   range). Verified: saved a 2-floor result as A, a 3-floor result as B,
   confirmed the table showed both side by side with correct, distinct
   numbers for each.
8. `SHIPPED` **Accessibility — first real pass, not just guessing.** Actually
   tested this time rather than assumed: room inputs got unique ids + real
   `aria-label`s (previously anonymous to a screen reader), result panel gets
   keyboard focus after a calculation instead of just visually scrolling,
   added a skip-to-form link (verified via `.click()` — a synthetic Enter
   keypress didn't trigger native link activation in the test tool, which is
   a tooling quirk, not an app bug), and tables got `aria-label`s. This is a
   first pass, not a full audit — screen-reader software wasn't used to
   verify, only DOM/ARIA structure and keyboard tab order.
9. `SHIPPED` **Unit/currency disclosure.** Added directly under the hero
   tagline: "All prices in Indian Rupees (₹) · all dimensions in feet (ft)."
10. `SHIPPED` **Sticky running total.** A fixed bar appears once the main
    total scrolls out of view (`IntersectionObserver`-driven), confirmed to
    show/hide correctly by scrolling the total in and out of the viewport.
11. `SHIPPED` **Inline field-level errors.** Each numeric field and each room
    row now shows its own error message with `aria-invalid`/`aria-describedby`
    wired up, instead of only a top banner. Found and fixed a real bug during
    verification: native HTML5 `required`/`min`/`max` validation was
    intercepting the submit before the custom validator ran in some cases,
    showing a browser tooltip instead of the styled inline error — fixed by
    adding `novalidate` to the form and relying on one consistent validation
    path.

One bug caught and fixed mid-implementation (not shipped broken): the compare
panel's own CSS (`display: flex`) was overriding the browser's native
`[hidden]` behavior, so it showed up even with zero saved scenarios — fixed
with `.compare-panel:not([hidden])` instead of an unconditional `display`.

**Nothing left open from either shortlist.** Everything raised across all
`customer-feedback` reviews and both `prd-review` shortlists is now shipped.

---

## Bug found by the user, not by either skill — 2026-08-08 (same day)

While actually testing the running app themselves, the user found a real gap
neither skill's validation pass had covered: a room's dimensions were only
checked against their own min/max (4-100 ft) and the plot's dimensions were
only checked against their own min/max (10-500 ft) — nothing cross-checked
that a room actually *fits inside* the plot. A 10x23 ft plot with a 12x42 ft
room passed validation and produced a full priced estimate.

- `SHIPPED` **Room-vs-plot dimension check.** Each room's length/width is now
  rejected if it exceeds the plot's longer side. Verified with the user's
  exact numbers (plot 10x23, room 12x42) — now `400`: "Room 1 (12 x 42 ft) is
  larger than the plot itself (10 x 23 ft)."
- `SHIPPED` **Aggregate footprint check, added proactively alongside it.**
  A single oversized room isn't the only way this breaks — three individually
  valid 12x12 rooms on a 12x12 plot (144 sqft) each pass their own min/max but
  together need 540 sqft. Verified this is now also rejected, with the actual
  numbers stated in the error.
- Verified a known-good baseline scenario (the one used throughout every
  other review) still returns `200` with the same total as before — no
  regression.

Root cause note: both earlier validation passes (this skill's shortlist item
1, and the customer-feedback addendum) checked that individual numbers were
*sane in isolation*. Neither checked *relationships between* numbers. That's
the category to watch for in any future validation work on this app.
