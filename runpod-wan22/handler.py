import asyncio
import logging
import os
import shutil
import tempfile
import traceback
from pathlib import Path
from typing import Any, Dict

import httpx
import runpod
import torch
from PIL import Image

import server as wan_server


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s | %(levelname)s | %(message)s",
)

log = logging.getLogger("amkaai-serverless")


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

            # Inform RunPod about progress.
            try:
                runpod.serverless.progress_update(
                    job,
                    {
                        "status": "PROCESSING",
                        "progress": progress,
                        "clip": index + 1,
                        "clip_count": clip_count,
                    },
                )
            except Exception:
                log.debug(
                    "Progress update failed",
                    exc_info=True,
                )

            with wan_server.job_lock:

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

            wan_server.save_tensor_to_mp4(
                video,
                clip_path,
            )

            generated.append(clip_path)

            del video

            if torch.cuda.is_available():
                torch.cuda.empty_cache()

        final_path = workdir / "final.mp4"

        wan_server.concat_mp4(
            generated,
            final_path,
        )

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