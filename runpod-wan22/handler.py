import asyncio
import logging
import os
import shutil
import tempfile
import threading
import time
import traceback
from pathlib import Path
from typing import Any, Dict
from contextlib import contextmanager

import httpx
import runpod
import torch
from PIL import Image

import server as wan_server
import wan.textimage2video as wan_ti2v_module


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s | %(levelname)s | %(message)s",
)

log = logging.getLogger("amkaai-serverless")


# ---------------------------------------------------------------------------
# Attention fallback (no flash-attn required)
#
# Wan's model calls wan.modules.attention.flash_attention() directly, and that
# function does `assert FLASH_ATTN_2_AVAILABLE`. Without the flash-attn package
# the job dies with AssertionError. PyTorch's scaled_dot_product_attention has
# its own fused FlashAttention kernels (Ampere/Ada/Blackwell), so we route to
# it instead. If flash-attn *is* installed, we leave Wan untouched.
# ---------------------------------------------------------------------------
def install_sdpa_attention_fallback() -> bool:
    import importlib.util

    if importlib.util.find_spec("flash_attn") is not None:
        log.info("flash-attn found: using Wan's native attention")
        return False

    import torch.nn.functional as F
    import wan.modules.attention as wan_attention
    import wan.modules.model as wan_model

    def sdpa_flash_attention(
        q,
        k,
        v,
        q_lens=None,
        k_lens=None,
        dropout_p=0.0,
        softmax_scale=None,
        q_scale=None,
        causal=False,
        window_size=(-1, -1),
        deterministic=False,
        dtype=torch.bfloat16,
        version=None,
    ):
        # q: [B, Lq, N, C]   k, v: [B, Lk, N, C]   (same layout as Wan's flash_attention)
        out_dtype = q.dtype
        compute_dtype = dtype if dtype in (torch.float16, torch.bfloat16) else torch.bfloat16

        if q_scale is not None:
            q = q * q_scale

        attn_mask = None
        if k_lens is not None:
            if k.size(0) == 1:
                # Single sample (what this server runs): drop padded keys instead of masking.
                valid = int(k_lens[0])
                k = k[:, :valid]
                v = v[:, :valid]
            else:
                positions = torch.arange(k.size(1), device=k.device)[None, :]
                attn_mask = (positions < k_lens.to(k.device)[:, None])[:, None, None, :]

        q_ = q.transpose(1, 2).to(compute_dtype)
        k_ = k.transpose(1, 2).to(compute_dtype)
        v_ = v.transpose(1, 2).to(compute_dtype)

        out = F.scaled_dot_product_attention(
            q_,
            k_,
            v_,
            attn_mask=attn_mask,
            is_causal=causal,
            dropout_p=dropout_p,
            scale=softmax_scale,
        )
        return out.transpose(1, 2).contiguous().to(out_dtype)

    wan_attention.flash_attention = sdpa_flash_attention
    wan_model.flash_attention = sdpa_flash_attention

    import wan.modules as wan_modules

    if hasattr(wan_modules, "flash_attention"):
        wan_modules.flash_attention = sdpa_flash_attention

    log.info("flash-attn not installed: patched Wan attention to use PyTorch SDPA")
    return True


try:
    install_sdpa_attention_fallback()
except Exception:  # never prevent the worker from booting
    log.exception("Could not install the SDPA attention fallback")


def post_webhook_sync(url: str, payload: Dict[str, Any]) -> None:
    """
    Send the result to the existing AMKAAI webhook.
    We keep this compatible with the current /api/webhook/runpod route.
    """
    last_error = None

    for attempt in range(5):
        try:
            with httpx.Client(timeout=30, follow_redirects=True) as client:
                response = client.post(url, json=payload)
                response.raise_for_status()
                log.info(
                    "Webhook delivered successfully attempt=%s status=%s",
                    attempt + 1,
                    response.status_code,
                )
                return

        except Exception as exc:
            last_error = exc
            wait_seconds = min(2 ** attempt, 16)

            log.warning(
                "Webhook attempt=%s failed: %s",
                attempt + 1,
                exc,
            )

            if attempt < 4:
                import time
                time.sleep(wait_seconds)

    raise RuntimeError(f"WEBHOOK_DELIVERY_FAILED: {last_error}")


def ensure_serverless_model() -> None:
    """
    Reuse the existing Wan2.2 model-loading logic.
    This happens once when a worker starts, not once per request.
    """
    if wan_server.model_ready and wan_server.model is not None:
        log.info("Wan2.2 model already loaded")
        return

    log.info("Loading Wan2.2 model...")

    wan_server.configure_cloudinary()
    wan_server.ensure_model()

    if not wan_server.model_ready or wan_server.model is None:
        raise RuntimeError(
            wan_server.model_error or "WAN_MODEL_NOT_READY"
        )

    log.info("Wan2.2 model is ready")


def safe_job_id(value: str) -> str:
    return "".join(
        character if character.isalnum() or character in ("-", "_")
        else "_"
        for character in value
    )


class ProgressReporter:
    """
    Publishes real Wan progress to RunPod and to the AmkaAI webhook.

    IMPORTANT: publishing happens on a background thread, with a single short
    attempt per update. The previous version posted synchronously from inside
    the diffusion loop with 5 retries / 30s timeouts, so an unreachable webhook
    URL could stall the GPU for minutes per step and the bar never moved.

    Progress map (always monotonic):
        0-8    preparing / downloading input
        8-90   clips: sampling steps (0-90% of a clip), VAE decode (90-96%),
               mp4 encode (96-100%)
        91-92  concatenating clips
        93-99  uploading        (100 is sent by the COMPLETED webhook)
    """

    BASE = 8
    SPAN = 82

    def __init__(self, job: Dict[str, Any], webhook_url: str, clip_count: int, total_steps: int):
        self.job = job
        self.webhook_url = webhook_url
        self.clip_count = max(1, clip_count)
        self.total_steps = max(1, total_steps)
        self.clip_index = 0
        self.last_progress = 0
        self.last_sent_at = 0.0
        self.min_interval = float(os.getenv("WAN_PROGRESS_MIN_INTERVAL", "2.0"))
        self._lock = threading.Lock()
        self._pending: Dict[str, Any] | None = None
        self._wake = threading.Event()
        self._stop = False
        self._thread = threading.Thread(target=self._run, daemon=True, name="progress-sender")
        self._thread.start()

    # ---- public API -------------------------------------------------------
    def begin_clip(self, index: int) -> None:
        self.clip_index = index
        self._publish("GENERATING", within=0.0, step=0, total=self.total_steps, force=True)

    def update(self, step: int) -> None:
        """Called after every diffusion step."""
        step = max(0, min(step, self.total_steps))
        if step >= self.total_steps:
            self._publish("DECODING", within=0.90, step=step, total=self.total_steps, force=True)
        else:
            self._publish("GENERATING", within=0.90 * step / self.total_steps, step=step, total=self.total_steps)

    def clip_stage(self, stage: str, within: float) -> None:
        self._publish(stage, within=within, force=True)

    def overall_stage(self, stage: str, overall: int) -> None:
        self._send(stage, max(self.last_progress, overall), force=True)

    def close(self) -> None:
        self._stop = True
        self._wake.set()
        self._thread.join(timeout=3)

    # ---- internals --------------------------------------------------------
    def _publish(self, stage, within, step=None, total=None, force=False) -> None:
        frac = (self.clip_index + max(0.0, min(1.0, within))) / self.clip_count
        progress = min(90, int(self.BASE + frac * self.SPAN))
        self._send(stage, max(self.last_progress, progress), step=step, total=total, force=force)

    def _send(self, stage, progress, step=None, total=None, force=False) -> None:
        now = time.monotonic()
        if not force and now - self.last_sent_at < self.min_interval:
            return
        self.last_progress = progress
        self.last_sent_at = now
        payload = {
            "id": str(self.job.get("input", {}).get("job_id") or self.job.get("id") or ""),
            "status": "PROCESSING",
            "progress": progress,
            "output": {
                "stage": stage,
                "clip": self.clip_index + 1,
                "clip_count": self.clip_count,
                "step": step,
                "total_steps": total,
            },
        }
        with self._lock:
            self._pending = payload  # keep only the newest
        self._wake.set()

    def _run(self) -> None:
        with httpx.Client(timeout=6, follow_redirects=True) as client:
            while True:
                self._wake.wait(timeout=1.0)
                self._wake.clear()
                with self._lock:
                    payload, self._pending = self._pending, None
                if payload is not None:
                    try:
                        runpod.serverless.progress_update(self.job, payload)
                    except Exception:
                        log.debug("RunPod progress update failed", exc_info=True)
                    try:
                        r = client.post(self.webhook_url, json=payload)
                        if r.status_code >= 400:
                            log.warning("Progress webhook rejected: HTTP %s %s", r.status_code, r.text[:200])
                    except Exception as exc:
                        log.warning("Progress webhook unreachable: %s", exc)
                if self._stop and self._pending is None:
                    return


@contextmanager
def wan_progress_hook(reporter: ProgressReporter):
    """
    Wan2.2 uses tqdm directly inside wan.textimage2video for its diffusion
    loop. Wrap that iterator so we can observe the actual step number without
    modifying the upstream Wan source code.
    """
    original_tqdm = wan_ti2v_module.tqdm

    def tracked_tqdm(iterable, *args, **kwargs):
        for step_index, item in enumerate(iterable, start=1):
            yield item
            reporter.update(step_index)

    wan_ti2v_module.tqdm = tracked_tqdm
    try:
        yield
    finally:
        wan_ti2v_module.tqdm = original_tqdm


def handler(job: Dict[str, Any]) -> Dict[str, Any]:
    """
    RunPod Serverless entry point.

    Expected input:

    {
        "job_id": "...",
        "custom_id": "...",
        "webhook_url": "...",
        "prompt": "...",
        "idea": "...",
        "duration_seconds": 5,
        "clip_length_seconds": 5,
        "clip_count": 1,
        "model": "Wan2.2-TI2V-5B",
        "image_url": "...",
        "seed": 123
    }
    """

    job_input = job.get("input") or {}

    external_id = (
        str(job_input.get("custom_id") or "")
        or str(job_input.get("job_id") or "")
        or str(job.get("id") or "")
    )

    webhook_url = str(job_input.get("webhook_url") or "").strip()
    prompt = str(job_input.get("prompt") or "").strip()

    if not external_id:
        raise ValueError("MISSING_JOB_ID")

    if not webhook_url:
        raise ValueError("MISSING_WEBHOOK_URL")

    if not prompt:
        raise ValueError("MISSING_PROMPT")

    log.info(
        "Starting Serverless job id=%s runpod_job=%s",
        external_id,
        job.get("id"),
    )

    workdir = Path(
        wan_server.JOBS_DIR
    ) / safe_job_id(external_id)

    workdir.mkdir(parents=True, exist_ok=True)

    reporter: ProgressReporter | None = None

    try:
        ensure_serverless_model()

        clip_count = max(
            1,
            min(
                int(job_input.get("clip_count") or 1),
                60,
            ),
        )

        duration_seconds = float(
            job_input.get("duration_seconds")
            or wan_server.DEFAULT_CLIP_SECONDS
        )

        model_name = str(
            job_input.get("model")
            or "Wan2.2-TI2V-5B"
        )

        image_url = job_input.get("image_url")

        reporter = ProgressReporter(
            job=job,
            webhook_url=webhook_url,
            clip_count=clip_count,
            total_steps=wan_server.SAMPLING_STEPS,
        )
        reporter.overall_stage("PREPARING", 5)

        image_path = None

        if image_url:
            image_path = wan_server.download_image(
                str(image_url),
                workdir / "input.png",
            )

        generated = []

        for index in range(clip_count):

            clip_prompt = prompt

            if clip_count > 1:
                clip_prompt = (
                    f"{prompt}\n\n"
                    f"SHOT {index + 1} OF {clip_count}. "
                    "Keep the same visual identity and style "
                    "as the requested concept."
                )

            seed_value = job_input.get("seed")

            if seed_value is None:
                seed = -1
            else:
                seed = int(seed_value)

            if seed >= 0:
                seed = seed + index

            progress = int(
                (index / clip_count) * 90
            )

            log.info(
                "Generating job=%s clip=%s/%s steps=%s",
                external_id,
                index + 1,
                clip_count,
                wan_server.SAMPLING_STEPS,
            )

            reporter.begin_clip(index)

            with wan_server.job_lock:
                with wan_progress_hook(reporter):
                    video = wan_server.model.generate(
                        clip_prompt,
                        img=(
                            Image.open(image_path).convert("RGB")
                            if image_path
                            else None
                        ),
                        size=wan_server.VIDEO_SIZE,
                        max_area=wan_server.MAX_AREA,
                        frame_num=wan_server.FRAME_NUM,
                        shift=wan_server.SHIFT,
                        sample_solver="unipc",
                        sampling_steps=wan_server.SAMPLING_STEPS,
                        guide_scale=wan_server.GUIDE_SCALE,
                        seed=seed,
                        offload_model=wan_server.OFFLOAD_MODEL,
                    )

            if video is None:
                raise RuntimeError(
                    "WAN_GENERATION_RETURNED_NO_VIDEO"
                )

            clip_path = (
                workdir / f"clip_{index:03d}.mp4"
            )

            reporter.clip_stage("ENCODING", 0.96)
            wan_server.save_tensor_to_mp4(
                video,
                clip_path,
            )

            generated.append(clip_path)
            reporter.clip_stage("ENCODING", 1.0)

            del video

            if torch.cuda.is_available():
                torch.cuda.empty_cache()

        reporter.overall_stage("ENCODING", 91)
        final_path = workdir / "final.mp4"

        wan_server.concat_mp4(
            generated,
            final_path,
        )

        reporter.overall_stage("UPLOADING", 93)

        log.info(
            "Uploading final video job=%s",
            external_id,
        )

        video_url = wan_server.upload_video(
            final_path,
            str(
                job_input.get("job_id")
                or external_id
            ),
        )

        reporter.close()  # flush progress before the final webhook

        payload = {
            "id": external_id,
            "status": "COMPLETED",
            "output": {
                "video_url": video_url,
                "model": model_name,
                "duration_seconds": duration_seconds,
                "clip_count": clip_count,
            },
        }

        post_webhook_sync(
            webhook_url,
            payload,
        )

        log.info(
            "Completed Serverless job=%s url=%s",
            external_id,
            video_url,
        )

        try:
            runpod.serverless.progress_update(
                job,
                {
                    "status": "COMPLETED",
                    "progress": 100,
                    "video_url": video_url,
                },
            )
        except Exception:
            log.debug(
                "Final progress update failed",
                exc_info=True,
            )

        return payload

    except Exception as exc:

        error_message = (
            f"{type(exc).__name__}: {exc}"
        )

        log.error(
            "Serverless job failed id=%s error=%s",
            external_id,
            error_message,
        )

        traceback.print_exc()

        failure_payload = {
            "id": external_id,
            "status": "FAILED",
            "error": error_message,
        }

        try:
            post_webhook_sync(
                webhook_url,
                failure_payload,
            )
        except Exception:
            log.exception(
                "Failed to deliver failure webhook"
            )

        raise

    finally:
        if reporter is not None:
            reporter.close()

        # Keep the generated result available until the handler has
        # returned to RunPod. Then clean the temporary job directory.
        try:
            if workdir.exists():
                shutil.rmtree(
                    workdir,
                    ignore_errors=True,
                )
        except Exception:
            log.debug(
                "Workdir cleanup failed",
                exc_info=True,
            )


if __name__ == "__main__":
    log.info(
        "Starting AMKAAI Wan2.2 Serverless worker"
    )

    ensure_serverless_model()

    runpod.serverless.start(
        {
            "handler": handler,
        }
    )