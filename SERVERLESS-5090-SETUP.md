# AmkaAI — Serverless on RTX 5090 (setup)

## 1. Build & push the image (build context = project root)
    docker build -f runpod-wan22/Dockerfile.serverless.rtx5090 -t <you>/amkaai-wan22:5090 .
    docker push <you>/amkaai-wan22:5090

The build fails on purpose if torch has no sm_120 kernels. flash-attn is NOT installed
(its 2.7.x kernels do not support Blackwell; Wan falls back to PyTorch SDPA).

## 2. RunPod console -> Serverless endpoint
- Container image: <you>/amkaai-wan22:5090   (use a NEW tag, never reuse :latest)
- GPU: **RTX 5090** (32 GB) — in the endpoint's GPU list
- Network volume: attach one (>= 60 GB) -> it mounts at /runpod-volume.
  Weights (~34 GB) download there once; without it every cold start re-downloads them.
- Container disk: >= 30 GB
- Max workers 1, Active workers 0 (or 1 to avoid cold starts), Idle timeout ~60-300 s
- Execution timeout: >= 1800 s   (30 s video = 6 clips)

## 3. App env (Vercel + worker)
    RUNPOD_API_KEY=...
    RUNPOD_SERVERLESS_ENDPOINT_ID=...
    RUNPOD_WEBHOOK_SECRET=...
    NEXT_PUBLIC_APP_URL=https://<public-domain>     # NOT localhost: the GPU must reach it
    RUNPOD_DIRECT_POD_ENABLED=false                 # keep Serverless path

## 4. Verify progress
Worker logs should show `Webhook delivered` / no `Progress webhook unreachable`.
If you see `Progress webhook rejected: HTTP 401` -> secret mismatch; `404` -> wrong APP_URL.

## 5. If CUDA OOM
Default is WAN_OFFLOAD_MODEL=true, WAN_T5_CPU=true (safe). On the 32 GB 5090 you can try
WAN_OFFLOAD_MODEL=false for speed once the first generation succeeds.
