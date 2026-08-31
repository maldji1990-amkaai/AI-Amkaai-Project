import asyncio
import hashlib
import json
import logging
import os
import shutil
import subprocess
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

import cloudinary
import cloudinary.uploader
import httpx
import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from huggingface_hub import snapshot_download
from PIL import Image
from pydantic import BaseModel, Field

import sys
WAN_REPO_DIR = os.getenv("WAN_REPO_DIR", "/opt/Wan2.2")
if WAN_REPO_DIR not in sys.path:
    sys.path.insert(0, WAN_REPO_DIR)

from wan.configs import MAX_AREA_CONFIGS, SIZE_CONFIGS, WAN_CONFIGS
import wan


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="[%(asctime)s] %(levelname)s %(message)s",
)
log = logging.getLogger("amkaai-wan22")

APP = FastAPI(title="AmkaAI Wan 2.2 TI2V-5B", version="1.0.0")

MODEL_ID = os.getenv("WAN_MODEL_ID", "Wan-AI/Wan2.2-TI2V-5B")
MODEL_DIR = Path(os.getenv("WAN_MODEL_DIR", "/workspace/models/Wan2.2-TI2V-5B"))
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "/workspace/outputs"))
JOBS_DIR = Path(os.getenv("JOBS_DIR", "/workspace/jobs"))

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
VIDEO_FPS = int(os.getenv("WAN_FPS", "24"))
VIDEO_WIDTH = int(os.getenv("WAN_WIDTH", "1280"))
VIDEO_HEIGHT = int(os.getenv("WAN_HEIGHT", "704"))
VIDEO_SIZE = (VIDEO_WIDTH, VIDEO_HEIGHT)
MAX_AREA = VIDEO_WIDTH * VIDEO_HEIGHT
FRAME_NUM = int(os.getenv("WAN_FRAME_NUM", "121"))
SAMPLING_STEPS = int(os.getenv("WAN_SAMPLING_STEPS", "40"))
GUIDE_SCALE = float(os.getenv("WAN_GUIDE_SCALE", "5.0"))
SHIFT = float(os.getenv("WAN_SHIFT", "5.0"))
OFFLOAD_MODEL = os.getenv("WAN_OFFLOAD_MODEL", "true").lower() == "true"
T5_CPU = os.getenv("WAN_T5_CPU", "true").lower() == "true"
CONVERT_DTYPE = os.getenv("WAN_CONVERT_MODEL_DTYPE", "true").lower() == "true"
MAX_QUEUE = int(os.getenv("WAN_MAX_QUEUE", "8"))

# The current app sends 5-second clips. 121 frames at 24fps is the official
# 4n+1 frame shape and is approximately 5 seconds.
DEFAULT_CLIP_SECONDS = float(os.getenv("WAN_CLIP_SECONDS", "5"))

model_ready = False
model_error: Optional[str] = None
model = None
job_lock = threading.Lock()
jobs: Dict[str, Dict[str, Any]] = {}
cancel_events: Dict[str, threading.Event] = {}
generation_thread: Optional[threading.Thread] = None


class GenerateRequest(BaseModel):
    job_id: str = Field(min_length=1)
    custom_id: Optional[str] = None
    webhook_url: str = Field(min_length=1)
    prompt: str = Field(min_length=1)
    idea: Optional[str] = None
    duration_seconds: float = 5
    clip_length_seconds: float = 5
    clip_count: int = 1
    model: str = "Wan2.2-TI2V-5B"
    image_url: Optional[str] = None
    seed: Optional[int] = None


def configure_cloudinary() -> None:
    cloud = os.getenv("CLOUDINARY_CLOUD")
    key = os.getenv("CLOUDINARY_API_KEY")
    secret = os.getenv("CLOUDINARY_API_SECRET")
    if cloud and key and secret:
        cloudinary.config(
            cloud_name=cloud,
            api_key=key,
            api_secret=secret,
            secure=True,
        )
    else:
        log.warning("Cloudinary credentials are not configured; completed jobs cannot be persisted.")


def ensure_model() -> None:
    global model_ready, model_error, model
    try:
        MODEL_DIR.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        JOBS_DIR.mkdir(parents=True, exist_ok=True)

        required = [
            MODEL_DIR / "config.json",
            MODEL_DIR / "Wan2.2_VAE.pth",
            MODEL_DIR / "diffusion_pytorch_model.safetensors.index.json",
        ]
        if not all(p.exists() for p in required):
            log.info("Downloading %s into %s", MODEL_ID, MODEL_DIR)
            snapshot_download(
                repo_id=MODEL_ID,
                local_dir=str(MODEL_DIR),
                local_dir_use_symlinks=False,
            )

        if not all(p.exists() for p in required):
            raise RuntimeError("Wan model download completed but required files are missing")

        cfg = WAN_CONFIGS["ti2v-5B"]
        log.info("Loading WanTI2V model into GPU/CPU memory")
        model = wan.WanTI2V(
            config=cfg,
            checkpoint_dir=str(MODEL_DIR),
            device_id=0,
            rank=0,
            t5_fsdp=False,
            dit_fsdp=False,
            use_sp=False,
            t5_cpu=T5_CPU,
            convert_model_dtype=CONVERT_DTYPE,
        )
        model_ready = True
        model_error = None
        log.info("Wan2.2 TI2V-5B is READY")
    except Exception as exc:
        model_ready = False
        model_error = f"{type(exc).__name__}: {exc}"
        log.exception("Wan model initialization failed")


def safe_job_id(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:32]


def download_image(url: str, destination: Path) -> Path:
    parsed = httpx.URL(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("image_url must use http or https")
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")
        if not content_type.startswith("image/"):
            raise ValueError("image_url did not return an image")
        destination.write_bytes(response.content)
    with Image.open(destination) as im:
        im.verify()
    return destination


def save_tensor_to_mp4(video_tensor: torch.Tensor, output_path: Path) -> None:
    from wan.utils.utils import save_video
    output_path.parent.mkdir(parents=True, exist_ok=True)
    save_video(
        tensor=video_tensor[None],
        save_file=str(output_path),
        fps=VIDEO_FPS,
        nrow=1,
        normalize=True,
        value_range=(-1, 1),
    )


def concat_mp4(files, destination: Path) -> None:
    if len(files) == 1:
        shutil.copy2(files[0], destination)
        return
    manifest = destination.with_suffix(".concat.txt")
    manifest.write_text(
        "".join(f"file '{Path(p).resolve().as_posix().replace(chr(39), chr(39)+chr(92)+chr(39)+chr(39))}'\n" for p in files),
        encoding="utf-8",
    )
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-f", "concat", "-safe", "0",
                "-i", str(manifest), "-c", "copy", str(destination),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
        )
    finally:
        manifest.unlink(missing_ok=True)


def upload_video(path: Path, job_id: str) -> str:
    if not (
        os.getenv("CLOUDINARY_CLOUD")
        and os.getenv("CLOUDINARY_API_KEY")
        and os.getenv("CLOUDINARY_API_SECRET")
    ):
        raise RuntimeError("CLOUDINARY_CONFIGURATION_MISSING")
    result = cloudinary.uploader.upload_large(
        str(path),
        resource_type="video",
        folder=os.getenv("CLOUDINARY_VIDEO_FOLDER", "amkaai/videos"),
        public_id=f"video_{safe_job_id(job_id)}",
        overwrite=True,
    )
    return str(result["secure_url"])


async def post_webhook(url: str, payload: Dict[str, Any]) -> None:
    last_error = None
    for attempt in range(5):
        try:
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                return
        except Exception as exc:
            last_error = exc
            await asyncio.sleep(min(2 ** attempt, 10))
    raise RuntimeError(f"WEBHOOK_FAILED: {last_error}")


def generate_job(request: GenerateRequest, external_id: str) -> None:
    event = cancel_events[external_id]
    job = jobs[external_id]
    workdir = JOBS_DIR / safe_job_id(external_id)
    workdir.mkdir(parents=True, exist_ok=True)

    try:
        if not model_ready or model is None:
            raise RuntimeError(model_error or "WAN_MODEL_NOT_READY")

        clip_count = max(1, min(int(request.clip_count or 1), 60))
        prompt_base = request.prompt.strip()
        image_path = None

        if request.image_url:
            image_path = download_image(
                request.image_url,
                workdir / "input.png",
            )

        generated = []
        for index in range(clip_count):
            if event.is_set():
                raise InterruptedError("CANCELLED")

            clip_prompt = prompt_base
            if clip_count > 1:
                clip_prompt = (
                    f"{prompt_base}\n\n"
                    f"SHOT {index + 1} OF {clip_count}. "
                    "Keep the same visual identity and style as the requested concept."
                )

            seed = request.seed if request.seed is not None else -1
            if seed >= 0:
                seed = seed + index

            log.info(
                "Generating job=%s clip=%s/%s steps=%s",
                external_id, index + 1, clip_count, SAMPLING_STEPS,
            )

            with job_lock:
                video = model.generate(
                    clip_prompt,
                    img=Image.open(image_path).convert("RGB") if image_path else None,
                    size=VIDEO_SIZE,
                    max_area=MAX_AREA,
                    frame_num=FRAME_NUM,
                    shift=SHIFT,
                    sample_solver="unipc",
                    sampling_steps=SAMPLING_STEPS,
                    guide_scale=GUIDE_SCALE,
                    seed=seed,
                    offload_model=OFFLOAD_MODEL,
                )

            if video is None:
                raise RuntimeError("WAN_GENERATION_RETURNED_NO_VIDEO")

            clip_path = workdir / f"clip_{index:03d}.mp4"
            save_tensor_to_mp4(video, clip_path)
            generated.append(clip_path)
            job["progress"] = int(((index + 1) / clip_count) * 90)

            del video
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

        if event.is_set():
            raise InterruptedError("CANCELLED")

        final_path = workdir / "final.mp4"
        concat_mp4(generated, final_path)

        job["progress"] = 92
        video_url = upload_video(final_path, request.job_id)
        job["progress"] = 100
        job["status"] = "COMPLETED"
        job["video_url"] = video_url

        payload = {
            "id": external_id,
            "status": "COMPLETED",
            "output": {
                "video_url": video_url,
                "model": request.model,
                "duration_seconds": request.duration_seconds,
                "clip_count": clip_count,
            },
        }
        asyncio.run(post_webhook(request.webhook_url, payload))
        log.info("Completed job=%s url=%s", external_id, video_url)

    except InterruptedError:
        job["status"] = "CANCELLED"
        job["error"] = "Cancelled by user"
        asyncio.run(post_webhook(request.webhook_url, {
            "id": external_id,
            "status": "CANCELLED",
            "error": "Cancelled by user",
        }))
    except Exception as exc:
        job["status"] = "FAILED"
        job["error"] = f"{type(exc).__name__}: {exc}"
        log.exception("Job failed id=%s", external_id)
        try:
            asyncio.run(post_webhook(request.webhook_url, {
                "id": external_id,
                "status": "FAILED",
                "error": job["error"],
            }))
        except Exception:
            log.exception("Failed to send failure webhook")
    finally:
        cancel_events.pop(external_id, None)


@APP.on_event("startup")
def startup() -> None:
    configure_cloudinary()
    threading.Thread(target=ensure_model, daemon=True, name="wan-loader").start()


@APP.get("/health")
def health():
    if not torch.cuda.is_available():
        raise HTTPException(status_code=503, detail="CUDA is not available")
    if not model_ready:
        raise HTTPException(status_code=503, detail=model_error or "Wan model is loading")
    return {
        "ok": True,
        "model": "Wan2.2-TI2V-5B",
        "gpu": torch.cuda.get_device_name(0),
        "vram_gb": round(torch.cuda.get_device_properties(0).total_memory / 1024**3, 2),
    }


@APP.post("/generate")
def generate(request: GenerateRequest):
    if not model_ready:
        raise HTTPException(status_code=503, detail=model_error or "Wan model is loading")
    if len(jobs) >= MAX_QUEUE:
        raise HTTPException(status_code=429, detail="GPU queue is full")

    external_id = f"wan_{uuid.uuid4().hex}"
    jobs[external_id] = {
        "id": external_id,
        "status": "PROCESSING",
        "progress": 1,
        "created_at": time.time(),
        "video_url": None,
        "error": None,
    }
    cancel_events[external_id] = threading.Event()
    threading.Thread(
        target=generate_job,
        args=(request, external_id),
        daemon=True,
        name=f"wan-job-{external_id}",
    ).start()

    return {
        "id": external_id,
        "job_id": external_id,
        "status": "PROCESSING",
    }


@APP.post("/cancel/{external_id}")
def cancel(external_id: str):
    job = jobs.get(external_id)
    if not job:
        return {"ok": True, "status": "NOT_FOUND"}
    cancel_events.get(external_id, threading.Event()).set()
    job["status"] = "CANCELLING"
    return {"ok": True, "status": "CANCELLING", "id": external_id}


@APP.get("/status/{external_id}")
def status(external_id: str):
    job = jobs.get(external_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return job


if __name__ == "__main__":
    uvicorn.run(APP, host=HOST, port=PORT, log_level=os.getenv("UVICORN_LOG_LEVEL", "info"))
