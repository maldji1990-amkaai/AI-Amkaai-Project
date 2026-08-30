# AmkaAI v9 — Independent Vercel GPU Safety Net

This patch adds a Vercel Cron endpoint that independently calls `reconcileVideoGpu()`.
It is a safety layer only; the persistent VPS worker remains responsible for processing
BullMQ video jobs.

## What it protects against

- video worker process crash
- PM2 failure
- complete VPS outage
- stale RunPod GPU lease that needs reconciliation

## Files added

- `app/api/cron/video-gpu/route.ts`
- `.env.vercel-cron.example`
- `vercel.cron.snippet.json`

## Vercel setup

1. Add `CRON_SECRET` to the Vercel Production environment.
2. Merge the `crons` entry from `vercel.cron.snippet.json` into your existing `vercel.json`.
3. Redeploy the production application.
4. Confirm the Cron appears in the Vercel project Cron Jobs dashboard.

Do NOT replace an existing `vercel.json` blindly. Merge the `crons` array with any
existing configuration in that file.

## Security

The endpoint fails closed when `CRON_SECRET` is missing and requires:
`Authorization: Bearer <CRON_SECRET>`.

Do not put `CRON_SECRET` in `NEXT_PUBLIC_*` variables and never expose it to the browser.

## Schedule

The intended safety interval is every minute:
`* * * * *`

If the Vercel plan attached to the project does not permit a one-minute cron, use the
most frequent schedule available on that plan or upgrade the plan before production.
The VPS reconciler remains active independently.

## Important architecture

Vercel Cron is NOT the video worker. It only performs reconciliation/cleanup.

Production path:

Vercel app -> Redis/BullMQ -> persistent VPS worker -> RunPod RTX 4090 -> Wan 2.2

Safety path:

Vercel Cron -> reconcileVideoGpu() -> RunPod API

Both paths must use the same production Redis and the same RunPod account state.
