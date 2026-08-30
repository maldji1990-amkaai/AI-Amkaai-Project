# AmkaAI — Production Video Worker (Vercel + RunPod)

## Why this exists

The Next.js/Vercel app should handle HTTP requests and webhooks. The long-running BullMQ consumer and the RunPod GPU reconciler must run as separate processes on a persistent service (VPS, Railway worker, Render worker, Fly.io, etc.).

## Production processes

Run **both** processes on the persistent worker host:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run typecheck
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

The two PM2 processes are:

- `amkaai-video-worker` — consumes `video-queue` and dispatches jobs to the on-demand RTX 4090 Pod.
- `amkaai-gpu-reconciler` — independently reconciles the GPU state every minute. It can terminate an idle Pod even if the video worker has crashed.

The worker host does **not** need a GPU. Only RunPod supplies the RTX 4090.

## Required shared environment

The worker and reconciler must use the same:

- `REDIS_URL`
- `DATABASE_URL`
- `RUNPOD_API_KEY`
- `RUNPOD_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`
- RunPod Pod template/image configuration

Do not copy Vercel's entire `.env` blindly. Use `.env.worker` or the provider's secret manager and add only the variables required by the worker.

## Recovery behavior

### BullMQ recovery

BullMQ uses a lock/stalled-job mechanism. If the worker dies while consuming a queue job, BullMQ can move the stalled job back for processing.

### Provider submission idempotency

Before `/generate`, AmkaAI creates a Redis dispatch lease and always sends `job_id` and `custom_id` equal to the database `VideoJob.id`.

The Wan server should treat `custom_id`/`job_id` as an idempotency key. If it receives the same key twice, it should return the original provider job id rather than start a second generation.

This closes the dangerous crash window where the provider accepted a generation but the worker died before saving `externalJobId` in PostgreSQL.

### Pending-job recovery

The reconciler periodically checks old `PENDING` video jobs. If a queue entry is missing and there is no active dispatch lease, it safely re-enqueues the job. Queue entries use `jobId=VideoJob.id`, so duplicates are collapsed by BullMQ.

### GPU lease recovery

Active GPU leases are stored as Redis set members keyed by `VideoJob.id`, not as a fragile global counter. The reconciler rebuilds the set from `PROCESSING` database jobs before deciding whether the GPU can be terminated.

A completion/failure/cancellation webhook releases the exact job lease. Repeated webhooks are safe because `SREM` is idempotent.

## RunPod HTTP contract

The Pod must expose:

```text
GET  /health
POST /generate
POST /cancel/:providerJobId
GET  /status/:providerJobId   # recommended for advanced recovery
```

`POST /generate` should accept the AmkaAI payload and return:

```json
{ "id": "provider-job-id" }
```

When complete, the Pod posts to the supplied `webhook_url`:

```json
{
  "id": "provider-job-id",
  "status": "COMPLETED",
  "output": { "video_url": "https://..." },
  "executionTime": 123456,
  "cost": 0.12
}
```

or:

```json
{
  "id": "provider-job-id",
  "status": "FAILED",
  "error": "..."
}
```

## Health ports

The PM2 example exposes:

- `8787` worker health
- `8788` GPU reconciler health

Keep these ports private or protect them with your infrastructure firewall. They are not public AmkaAI API endpoints.

## Cost protection

- User price remains **5 Credits / second**.
- Video clips remain **5 seconds**.
- GPU is rented on demand and reused while work exists.
- GPU termination requires no active Redis leases and no queue work, plus the idle grace period.
- A failed/cancelled/completed job releases only its own lease.
- Credit refunds remain idempotent through the existing `Usage.refunded` guard.
- The RunPod callback records provider execution/cost data in the job input metadata when available.

## Launch checklist

1. Deploy the Next.js app to Vercel.
2. Deploy the worker service separately.
3. Start both PM2 processes.
4. Confirm both health processes are alive.
5. Confirm Redis connection.
6. Confirm the RunPod template contains the real Wan 2.2 TI2V-5B runtime.
7. Run one 5-second generation.
8. Verify the webhook marks the DB job completed.
9. Verify the exact Redis GPU lease disappears.
10. Verify the Pod terminates after the idle grace period.
11. Only then test 30/35/60-second videos.
