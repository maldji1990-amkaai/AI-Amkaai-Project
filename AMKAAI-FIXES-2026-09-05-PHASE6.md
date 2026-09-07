# AmkaAI Phase 6 — Dashboard & generation-flow hardening

- `/dashboard` is now a canonical redirect to `/dashboard/generate`, preventing users from landing on the older duplicate generator UI.
- Video API now returns explicit 409 responses when an idempotency/reference key has already been pending, completed, refunded, or otherwise consumed.
- Project multi-scene render now performs a credit preflight before queueing the first scene, preventing a predictable mid-production insufficient-credit failure.
- Protected RunPod files were not modified.
- Full dependency-backed typecheck/build still needs to be run in a complete install/CI environment.
