# AmkaAI — Release Candidate Checklist

## Scope
This release candidate contains the billing, credits, refunds, authorization, generation-safety and legacy-cleanup hardening completed through Phase 10.

## Mandatory production validation
Run from a clean environment with production credentials:

1. `npm ci`
2. `npx prisma generate`
3. `npm run typecheck`
4. `npm run build`
5. `npm run db:deploy`
6. Verify Clerk sign-in/sign-up and webhook delivery.
7. Verify PayPal sandbox/live configuration before switching `PAYPAL_MODE`.
8. Verify NOWPayments IPN secret and webhook signature validation.
9. Verify Redis/BullMQ connectivity.
10. Verify manual-payment approval from admin and confirm the expected amount is server-derived.
11. Verify Credits ledger entries for grant, usage and refund.
12. Verify duplicate webhook delivery does not grant Credits twice.
13. Verify cancellation keeps access until the current period ends when `cancelAtPeriodEnd=true`.
14. Verify ownership boundaries with two separate test users.
15. Verify failed AI generation automatically refunds reserved/used Credits where the generation path supports it.

## Security rules
- Never commit `.env`, `.env.local`, provider secrets, private keys or production credentials.
- Never enable `ALLOW_DEV_UPGRADE=true` in production.
- Never trust client-supplied plan price or Credit amount.
- Never expose another user's project, generation, scene, video job or asset by ID.

## RunPod protection
The following RunPod files are intentionally frozen for this project phase. They must remain byte-for-byte identical to the original baseline:

- `RUNPOD-4090-AUTO-MANAGER.md`
- `.env.runpod.example`
- `runpod-wan22/README.md`
- `runpod-wan22/requirements.txt`
- `runpod-wan22/.dockerignore`
- `runpod-wan22/Dockerfile`
- `runpod-wan22/server.py`
- `app/api/webhook/runpod/route.ts`
- `lib/runpod-pod-manager.ts`
- `lib/video-dispatch.ts`

## Important validation limitation
The automated container used during this repair could not complete a full dependency installation within its execution time limit. Therefore this archive is a Release Candidate, not a claim of a successful production build. The commands above must be executed in CI or the deployment environment before launch.
