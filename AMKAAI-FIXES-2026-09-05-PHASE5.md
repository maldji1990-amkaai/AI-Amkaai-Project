# AmkaAI Phase 5 — Generation & Credit Integrity

## Scope
- Hardened one-shot credit reservation references.
- Reusing a completed/refunded/pending usage reference is now rejected instead of silently allowing a second provider execution.
- Renamed the canonical generator mode from `image-to-avatar` to `image-to-video` to match the actual `/api/generate-image` behavior.
- Retired the legacy `/ai-image` page and redirect it to `/dashboard/generate`, preventing the old text-to-image UI from calling an image-to-video endpoint.
- Kept the canonical post-login generator at `/dashboard/generate`.

## RunPod constraint
The following RunPod-related files were not modified:
- `RUNPOD-4090-AUTO-MANAGER.md`
- `.env.runpod.example`
- `runpod-wan22/*`
- `app/api/webhook/runpod/route.ts`
- `lib/runpod-pod-manager.ts`
- `lib/video-dispatch.ts`

## Validation
- 113 TypeScript/TSX files transpilation-checked successfully.
- RunPod files compared against the original project: no differences.
- Secrets, `node_modules`, `.next`, and local SQLite databases remain excluded from the distributable ZIP.
