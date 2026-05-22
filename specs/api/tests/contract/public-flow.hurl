# Business Rules: [BR-29]
# Public endpoints contract test: verify unauthenticated org lookup
# by slug responds correctly.
#
# NO AUTH required — public endpoint.

# ── 1. Valid slug returns org data ─────────────────────────

GET {{api}}/public/org/pda-metro-manila
HTTP 200


# ── 2. Unknown slug returns 404 ───────────────────────────

GET {{api}}/public/org/nonexistent-org-slug-12345
HTTP 404
