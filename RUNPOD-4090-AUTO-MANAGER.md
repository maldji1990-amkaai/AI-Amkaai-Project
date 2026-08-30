# AmkaAI — RunPod RTX 4090 On-Demand Video Manager

This patch switches video dispatch from a permanent RunPod Serverless endpoint to an on-demand RTX 4090 Pod manager.

RunPod's current REST API supports creating Pods, starting/stopping them, and terminating them. AmkaAI uses that API to create a GPU only when the video queue needs one, reuse it while jobs are active, and terminate it after the queue is empty for the configured grace period.

## Required environment

```env
RUNPOD_DIRECT_POD_ENABLED=true
RUNPOD_API_KEY=...
RUNPOD_WEBHOOK_SECRET=...
NEXT_PUBLIC_APP_URL=https://amkaai.net

# Recommended: a RunPod Pod template containing Wan 2.2 TI2V-5B and a HTTP API.
RUNPOD_POD_TEMPLATE_ID=your-wan22-pod-template

# Or use a custom image instead of a template:
# RUNPOD_POD_IMAGE=your-registry/wan22-server:latest

RUNPOD_GPU_TYPE=NVIDIA GeForce RTX 4090
RUNPOD_CLOUD_TYPE=COMMUNITY
RUNPOD_POD_HTTP_PORT=8000
RUNPOD_POD_GENERATE_PATH=/generate
RUNPOD_POD_HEALTH_PATH=/health
RUNPOD_POD_CANCEL_PATH=/cancel
RUNPOD_POD_CONTAINER_DISK_GB=50
RUNPOD_POD_VOLUME_GB=40
RUNPOD_GPU_IDLE_GRACE_MS=300000
RUNPOD_POD_READY_TIMEOUT_MS=1200000
RUNPOD_POD_REQUEST_TIMEOUT_MS=30000

# The Pod HTTP service contract:
# POST /generate -> { "id": "provider-job-id" }
# GET  /health   -> 200 when Wan is loaded and ready
# POST /cancel/:id -> 2xx when cancellation is accepted
# The Pod must POST the same job's webhook_url when it finishes:
# { "id": "provider-job-id", "status": "COMPLETED", "output": { "video_url": "..." } }
# or { "id": "provider-job-id", "status": "FAILED", "error": "..." }

# Optional custom start configuration if not defined in the template/image.
# RUNPOD_POD_DOCKER_START_CMD=python server.py
# RUNPOD_POD_DOCKER_ENTRYPOINT=
# RUNPOD_POD_VOLUME_MOUNT_PATH=/workspace
# RUNPOD_POD_ENV_JSON={"MODEL":"Wan2.2-TI2V-5B"}
```

## Cost behavior

- User pricing remains **5 Credits / second**.
- Video is rendered in **5-second clips**.
- A 30-second video is 6 clips and costs 150 Credits.
- The GPU is not kept rented when there are no jobs.
- A running Pod is reused for multiple queued scenes/jobs.
- After all active and queued work is finished, AmkaAI waits for `RUNPOD_GPU_IDLE_GRACE_MS` and then terminates the Pod.
- A failed/cancelled scene releases the GPU lease; other scenes are not regenerated.
- Actual GPU time should be recorded from RunPod/worker logs before changing the 5 Credits/second price.

## Important

The patch cannot invent a Wan 2.2 serving image. The RunPod template/image must contain the actual Wan 2.2 TI2V-5B runtime and expose the HTTP service described above. This is intentionally configurable so you can use your tested Wan 2.2 container rather than an unverified image.
