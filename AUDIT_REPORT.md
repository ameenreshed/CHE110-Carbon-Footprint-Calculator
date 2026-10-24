# Eco / Carbotrack — Repository Audit & Fix Report

**Audit date:** 22 October 2026  
**Reviewed:** Uploaded `carbon_footprint.zip` (static HTML/CSS/JS + Supabase SQL)  
**Live-site limitation:** The direct live URL could not be retrieved by the web inspection tool, so the visual/runtime assessment below is based on the supplied repository. Browser-based end-to-end testing against production is still required.

## Summary

The repository has a solid multi-page foundation: calculator, results, methodology, dashboard/profile, challenge, leaderboard, certificate, responsive styles, and Supabase integration. It is more than a simple class demo.

**Current repository rating: 6.2/10 (static-code review, not a production certification).**

| Area | Rating | Notes |
|---|---:|---|
| Product idea / assignment fit | 8/10 | Clear sustainability purpose and meaningful user journey |
| UI / visual system | 7.5/10 | Extensive styling and multiple page types; needs a real-device visual pass |
| Calculator implementation | 6/10 | Multi-step form and deterministic engine; some assumptions need clearer explanation |
| Data / methodology credibility | 5/10 | Several factors are fixed averages and source editions/links are not consistently documented |
| Auth / database integration | 5/10 before patch | Frontend calls leaderboard RPCs missing from the supplied schema |
| Privacy / security | 4.5/10 before patch | Raw profile and carbon-result rows were publicly readable under the supplied RLS policies |
| Accessibility / resilience | 6.5/10 | Some thoughtful focus handling, but a full keyboard/screen-reader pass is needed |

## Fixes applied in this reviewed copy

1. **Added the missing leaderboard RPCs** used by `js/supabase-leaderboard.js`: `get_leaderboard`, `get_my_rank`, and `submit_carbon_result`. The original `schema.sql` created other RPCs but did not define these three functions, so the leaderboard and result submission could fail after a fresh schema setup.
2. **Restricted direct access to profile and result rows.** The revised RLS policies allow users to read their own profile/results; the public leaderboard should use the limited leaderboard RPC/view instead of exposing the full `carbon_results` table.
3. **Hardened toast rendering** by replacing interpolated message HTML with DOM nodes and `textContent`.
4. **Hardened result badge rendering** by using a whitelisted rating key and a text node for the label.
5. **Corrected the “Paris Agreement 2.0 t target” wording.** A project-defined 2.0-tonne reference is not an official personal Paris Agreement certification. Result, methodology, and certificate wording now describes it as an illustrative reference/modelled estimate.
6. **Allowed zero weekly waste bags.** The form and normalizer previously forced at least one bag, even if the user produces none.
7. **Added two promotional assets** in `promo-assets/`.

## Tests performed

- All JavaScript files passed `node --check` syntax validation.
- The calculation engine passed a smoke test for finite results, negative-input clamping, and a zero-waste input.
- Local HTML links and script/style references were checked for missing paths; no missing local files were found in that pass.
- A baseline scenario produced a finite result (5.61 t CO₂e/year) in the current model. This is a software smoke test, **not** validation that the emission factors are scientifically accurate.
- No live Supabase database connection, real browser automation, accessibility scanner, Lighthouse run, or production write test was available. Apply the SQL in a staging project first and test signup, sign-in, profile edit, score submit, leaderboard filters, challenge sync, and certificate generation before production.

## Remaining high-priority work

### P0 — Validate database patch in staging
Run `schema.sql` on a disposable Supabase project or apply `schema-patch-leaderboard.sql` after the existing schema. Confirm the RPC return shapes match the UI and verify RLS using both anonymous and authenticated test accounts. Do not blindly run schema changes on production without a backup.

### P0 — Rate-limit anonymous analytics RPCs
`record_visit` and `record_event` are executable by anonymous users. The supplied SQL validates some inputs, but public calls can still be scripted to inflate counters. Add server-side rate limits, deduplication, and strict metadata size/type limits; do not trust browser-generated session IDs as a security boundary.

### P1 — Revalidate emission factors and publish dated sources
The methodology table names source families, but a number of rows lack direct URLs, editions, or calculation notes. Re-check the electricity factor against the current CEA baseline database and document the exact edition; flight emissions vary substantially with route, cabin, aircraft and methodology. Mark all results as estimates and show assumptions next to the result.

### P1 — Make the score model transparent
The `ecoScore = 100 - totalTons * 8.5` mapping and tier cutoffs are project-defined heuristics. Label them as such rather than presenting them as a standardized environmental score. Add tests for boundary values at 2, 5 and 10 tonnes.

### P1 — Clarify the calculation inputs
Explain whether distances are one-way or round-trip, what a “flight” represents, how public transit days are estimated, how household electricity is divided, and what a waste bag weighs. Consider a location-specific electricity factor and a route-distance-based flight estimate.

### P1 — Finish PWA and resilience work if installability is a goal
The supplied `sw.js` handles notification clicks and push events but does not cache the app shell for offline use. No web app manifest was present in the supplied ZIP. Add a manifest, icons, update strategy and carefully scoped offline cache only if an installable/offline experience is part of the project requirement.

### P2 — Run real accessibility/performance tests
Test small Android screens, desktop zoom at 200%, keyboard-only navigation, focus visibility, reduced-motion preferences, color contrast, and screen-reader labels. Run Lighthouse against the deployed site and fix measured issues rather than guessing.

## Security notes

- The Supabase `anon` key in browser code is expected for a public client app; it is **not** a service-role key. Keep all service-role credentials out of frontend code and repositories.
- The supplied schema's public `SELECT` policies on `profiles` and `carbon_results` exposed more than the leaderboard needs. The revised copy limits direct reads, but you must verify the public `leaderboard_view` behaves as intended after the policy change.
- Leaderboard scores are submitted from a client. A determined user can alter browser-side values; treat them as self-reported estimates unless the server recalculates results from validated inputs.

## Live website rating status

The source is reviewable, but the direct site fetch failed in the inspection environment. Therefore, I have not claimed to verify production page rendering, console errors, current HTTP headers, actual load time, or real Supabase behaviour. The rating should be updated after the live smoke test.
