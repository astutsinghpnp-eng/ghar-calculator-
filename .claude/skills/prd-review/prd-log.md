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
