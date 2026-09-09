# Backend

## Regeneration: section-level vs. item-level

Kit content can be regenerated at two different granularities, and they behave differently on purpose:

- **Item-level** (`POST /:id/regenerate/questions/:category`) — regenerating a question category preserves every question the user has locked (`source: "edited"` or `"manual"`) and only replaces the ones still marked `source: "generated"`. Edits survive.
- **Section-level** (`POST /:id/regenerate/company-brief`) — this is the **one exception** to "never discard edits". `company_brief` is a single atomic object (`summary`, `what_they_do`, `sources`), not an array of individually-lockable items like questions or flashcards, so there's no per-field lock concept for it. Regenerating it **overwrites the whole section**, including any manual edits made via `PATCH /:id/company-brief`. This is deliberate, not an oversight — see the comment on `updateCompanyBrief` in `src/controllers/kitItemsController.ts` and on `regenerateCompanyBrief` in `src/controllers/kitRegenerateController.ts`.

`POST /:id/regenerate/schedule` is a third case: the schedule is fully *derived* from the current question set rather than independently editable content, so there's no locking concept at all — it's pure, cheap, and always safe to re-run.

## Retrieval cache

`Kit._retrievalCache` (internal only — not part of Appendix A, excluded from every API response) stores the company pages and discussion snippets from the kit's original generation. `regenerate/company-brief` reads from this cache instead of re-crawling the company's site and re-running discussion search on every regenerate.
