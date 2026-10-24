# Eco / Carbotrack reviewed copy

This is a reviewed copy of the supplied static website repository with source-level fixes and audit notes.

- Read `AUDIT_REPORT.md` for findings, ratings, fixes and remaining work.
- Read `PROMO_VIDEO_PLAN.md` for the 30-second and 15-second social demo plans.
- `schema-patch-leaderboard.sql` can be applied after the existing schema to add the missing leaderboard RPCs and harden direct table reads. Test in a staging Supabase project first.
- `promo-assets/eco-promo-wide.png` and `promo-assets/eco-promo-square.png` are generated promotional illustrations, not screenshots of the actual deployed interface.

The JavaScript syntax and calculator smoke tests passed locally. This is not a claim that production has been browser-tested or that the emissions methodology is independently validated.
