# Jimbot tool side effects

All tools return typed errors, never an empty successful result on failure. Common codes: `unauthenticated`, `forbidden`, `invalid_argument`, `not_found`, `rate_limited` (with `retryAfterMs`), `tool_unavailable`, and `internal_error`.

## `search_verified_businesses`

- Purpose: find verified places for itinerary planning or a standalone recommendation.
- Side effects: none. Server query must include `live = true` and `verification_status = 'verified'`.
- Failure modes: invalid filters, unavailable database, rate limit.
- Retry: read-safe. Retry transient failures at most twice with backoff; honor `retryAfterMs`.

## `get_business_details`

- Purpose: get details for one prior business result.
- Side effects: none. Reject IDs not returned in the current Jimbot context, or businesses that are not live and verified.
- Failure modes: invalid or unknown ID, stale/unverified business, unavailable database, rate limit.
- Retry: read-safe. Retry transient failures at most twice with backoff; do not retry invalid or stale IDs.

## `get_user_preferences`

- Purpose: load planning-relevant traveler preferences.
- Side effects: none.
- Failure modes: unauthenticated user, missing consent, unavailable database, rate limit.
- Retry: read-safe after consent is present. Retry transient failures at most twice with backoff; do not retry missing consent or authentication.

## `get_saved_itineraries`

- Purpose: load the signed-in user's saved itineraries.
- Side effects: none. Server must scope results to the authenticated user.
- Failure modes: unauthenticated user, invalid filter, unavailable database, rate limit.
- Retry: read-safe. Retry transient failures at most twice with backoff.

## `build_itinerary_draft`

- Purpose: create a read-only itinerary and budget draft from verified tool-result IDs.
- Side effects: none. It must not write an itinerary, stops, or planning data to the database.
- Failure modes: invalid dates, budget, or IDs; stale/unverified business; unavailable database; rate limit.
- Retry: read-safe. Retry transient failures at most twice with backoff; do not retry invalid or stale IDs.

## `show_map_points`

- Purpose: return map points for verified tool-result IDs.
- Side effects: none. Omit businesses missing `latitude` or `longitude`; never infer coordinates.
- Failure modes: invalid or stale ID, unavailable database, rate limit.
- Retry: read-safe. Retry transient failures at most twice with backoff; do not retry invalid or stale IDs.

## `save_itinerary`

- Purpose: persist a reviewed itinerary and its ordered stops for the signed-in user.
- Side effects: writes one `itineraries` row and its `itinerary_stops` rows. The operation must be atomic.
- Failure modes: unauthenticated user, `explicitConfirmed` missing or not `true`, invalid/stale/non-verified business ID, validation error, database timeout, rate limit.
- Retry: write. The server **must reject** calls without `explicitConfirmed=true`. Use a client-generated idempotency key and server-side deduplication. On a timeout, reconcile by that key before retrying; never blindly retry.
