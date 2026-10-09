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


def _perf_gpu_snapshot(label: str) -> None:
    if not torch.cuda.is_available():
        log.info("PERF_GPU label=%s cuda=false", label)
        return
    try:
        allocated = torch.cuda.memory_allocated() / (1024 ** 3)
        reserved = torch.cuda.memory_reserved() / (1024 ** 3)
        peak = torch.cuda.max_memory_allocated() / (1024 ** 3)
        total = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
        log.info(
            "PERF_GPU label=%s device=%s total_gb=%.2f allocated_gb=%.2f reserved_gb=%.2f peak_allocated_gb=%.2f",
            label, torch.cuda.get_device_name(0), total, allocated, reserved, peak,
        )
    except Exception:
        log.debug("PERF_GPU snapshot failed label=%s", label, exc_info=True)


def _perf_timer(label: str):
    start = time.perf_counter()
    log.info("PERF_START label=%s", label)
    _perf_gpu_snapshot(f"{label}:start")
    try:
        yield
    finally:
        _perf_gpu_snapshot(f"{label}:end")
        log.info("PERF_END label=%s elapsed_sec=%.3f", label, time.perf_counter() - start)

from contextlib import contextmanager
_perf_timer = contextmanager(_perf_timer)


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

# --- VRAM reduction: 8-bit quantization (bitsandbytes LLM.int8()) ---------
# Disabled by default. Set WAN_QUANTIZE_8BIT=true once the rebuilt image
# (with bitsandbytes installed) has been validated on real hardware.
# WAN_QUANTIZE_TARGETS is a comma-separated list of attribute names on the
# loaded `model` object whose Linear layers should be converted to 8-bit.
# "model" matches WanTI2V.model, the ~5B-parameter DiT transformer, which is
# by far the largest consumer of GPU weight memory (the VAE and T5 text
# encoder are left untouched by default to protect output quality).
QUANTIZE_8BIT = os.getenv("WAN_QUANTIZE_8BIT", "false").lower() == "true"
QUANTIZE_TARGETS = [
    t.strip() for t in os.getenv("WAN_QUANTIZE_TARGETS", "model").split(",") if t.strip()
]

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


# --- Live progress reporting ------------------------------------------------
# The app's webhook (app/api/webhook/runpod/route.ts) already accepts
# status=PROCESSING callbacks carrying {progress, output:{stage,clip,clip_count,
# step,total_steps}}. Previously nothing sent them, so the UI sat at 5% for the
# whole diffusion run. These helpers send real per-step progress.
PROGRESS_MIN_INTERVAL = float(os.getenv("WAN_PROGRESS_MIN_INTERVAL", "1.5"))
# Interrupting a diffusion pass is only safe when the DiT stays resident on the
# GPU (no CPU<->GPU weight shuffling), so default to "on" only without offload.
CANCEL_MID_STEP = os.getenv(
    "WAN_CANCEL_MID_STEP", "false" if OFFLOAD_MODEL else "true"
).lower() == "true"

_step_hook: Dict[str, Any] = {"cb": None}
_step_hook_installed = False


def install_step_hook() -> bool:
    """Wrap the tqdm used by Wan's sampling loop so we get a callback per step."""
    global _step_hook_installed
    if _step_hook_installed:
        return True
    try:
        import importlib
        mod = importlib.import_module("wan.textimage2video")
    except Exception:
        log.warning("Progress hook: cannot import wan.textimage2video", exc_info=True)
        return False

    orig = getattr(mod, "tqdm", None)
    if orig is None:
        log.warning("Progress hook: wan.textimage2video has no tqdm; per-step progress disabled")
        return False

    def tracked_tqdm(iterable=None, *args, **kwargs):
        inner = orig(iterable, *args, **kwargs)
        cb = _step_hook.get("cb")
        if cb is None or iterable is None:
            return inner
        try:
            total = len(iterable)
        except TypeError:
            return inner
        if total < 2:
            return inner

        def _gen():
            cb(0, total)
            for i, item in enumerate(inner):
                yield item
                cb(i + 1, total)

        return _gen()

    mod.tqdm = tracked_tqdm
    _step_hook_installed = True
    log.info("Progress hook installed (per-step progress enabled)")
    return True


class ProgressReporter:
    """Throttled, ordered, best-effort PROCESSING webhooks sent from a side thread."""

    def __init__(self, url: str, external_id: str, clip_count: int, job: Dict[str, Any]):
        self.url = url
        self.external_id = external_id
        self.clip_count = max(1, clip_count)
        self.job = job
        self._lock = threading.Lock()
        self._pending: Optional[Dict[str, Any]] = None
        self._wake = threading.Event()
        self._stop = False
        self._last_emit = 0.0
        self._last_progress = 0
        self._thread = threading.Thread(
            target=self._run, daemon=True, name=f"progress-{external_id}"
        )
        self._thread.start()

    def _overall(self, clip: int, within: float) -> int:
        # 0-5 prepare, 5-90 clips, 90-93 encode/concat, 93-99 upload
        value = 5 + ((clip - 1) + max(0.0, min(1.0, within))) / self.clip_count * 85
        return int(min(90, value))

    def emit(
        self,
        stage: str,
        clip: int = 1,
        within: float = 0.0,
        step: Optional[int] = None,
        total: Optional[int] = None,
        overall: Optional[int] = None,
        force: bool = False,
    ) -> None:
        progress = overall if overall is not None else self._overall(clip, within)
        progress = max(progress, self._last_progress)  # never go backwards
        self._last_progress = progress

        self.job["progress"] = progress
        self.job["stage"] = stage
        self.job["clip"] = clip
        self.job["clip_count"] = self.clip_count
        self.job["step"] = step
        self.job["total_steps"] = total

        now = time.time()
        if not force and now - self._last_emit < PROGRESS_MIN_INTERVAL:
            return
        self._last_emit = now

        payload = {
            "id": self.external_id,
            "status": "PROCESSING",
            "progress": progress,
            "output": {
                "stage": stage,
                "clip": clip,
                "clip_count": self.clip_count,
                "step": step,
                "total_steps": total,
            },
        }
        with self._lock:
            self._pending = payload
        self._wake.set()

    def emit_step(self, clip: int, step: int, total: int) -> None:
        done = step >= total
        self.emit(
            "DECODING" if done else "GENERATING",
            clip=clip,
            within=0.88 * (step / total),
            step=step,
            total=total,
            force=(step == 0 or done),
        )

    def _run(self) -> None:
        try:
            with httpx.Client(timeout=5, follow_redirects=True) as client:
                while True:
                    self._wake.wait(timeout=1.0)
                    self._wake.clear()
                    with self._lock:
                        payload, self._pending = self._pending, None
                    if payload is not None:
                        try:
                            client.post(self.url, json=payload).raise_for_status()
                        except Exception as exc:  # progress is best-effort
                            log.debug("progress webhook failed: %s", exc)
                    if self._stop:
                        return
        except Exception:
            log.debug("progress reporter crashed", exc_info=True)

    def close(self) -> None:
        self._stop = True
        self._wake.set()
        self._thread.join(timeout=3)



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


def _replace_linear_layers_int8(module: "torch.nn.Module", prefix: str = "") -> int:
    """
    Recursively replace torch.nn.Linear submodules of `module` in-place with
    bitsandbytes 8-bit linear layers (LLM.int8()). Returns the number of
    layers replaced. Any single layer that fails to convert (unusual shape,
    unsupported dtype, etc.) is left untouched rather than aborting the
    whole pass, so a partial success is still safe to run with.
    """
    import bitsandbytes as bnb

    replaced = 0
    for name, child in module.named_children():
        full_name = f"{prefix}.{name}" if prefix else name
        if isinstance(child, torch.nn.Linear):
            try:
                has_bias = child.bias is not None
                device = child.weight.device
                new_layer = bnb.nn.Linear8bitLt(
                    child.in_features,
                    child.out_features,
                    bias=has_bias,
                    has_fp16_weights=False,
                    threshold=6.0,
                )
                new_layer.load_state_dict(child.state_dict())
                # Moving to CUDA is what actually triggers bitsandbytes to
                # quantize the weights into int8 + per-channel scales.
                new_layer = new_layer.to(device)
                setattr(module, name, new_layer)
                replaced += 1
            except Exception:
                log.exception(
                    "Skipping 8-bit quantization for layer %s (left as-is)",
                    full_name,
                )
        else:
            replaced += _replace_linear_layers_int8(child, full_name)
    return replaced


def quantize_model_8bit() -> None:
    """
    Optional VRAM-reduction pass, run once right after the Wan model has
    finished loading. Converts the Linear layers inside the modules named in
    WAN_QUANTIZE_TARGETS (by default just the DiT transformer, `model.model`)
    to 8-bit weights via bitsandbytes. This is what lets the ~5B-parameter
    transformer fit with a real safety margin on 24GB GPUs instead of sitting
    within a few hundred MiB of the hardware limit, and can also make smaller
    GPU classes (e.g. 16GB) viable.

    Disabled unless WAN_QUANTIZE_8BIT=true. If bitsandbytes is not installed,
    or a given target attribute isn't found, this logs a warning and leaves
    the model running in its original precision instead of failing the job.
    """
    global model
    if model is None:
        return

    try:
        import bitsandbytes  # noqa: F401
    except ImportError:
        log.warning(
            "WAN_QUANTIZE_8BIT=true but the `bitsandbytes` package is not "
            "installed in this image; skipping quantization and running at "
            "full precision. Add `bitsandbytes` to the Docker image to use this."
        )
        return

    before_mb = torch.cuda.memory_allocated() / (1024 ** 2) if torch.cuda.is_available() else None

    total_replaced = 0
    for attr in QUANTIZE_TARGETS:
        submodule = getattr(model, attr, None)
        if not isinstance(submodule, torch.nn.Module):
            log.warning(
                "WAN_QUANTIZE_TARGETS: model.%s is not a torch module (got %r); skipping",
                attr, type(submodule),
            )
            continue
        try:
            replaced = _replace_linear_layers_int8(submodule, prefix=attr)
            total_replaced += replaced
            log.info("8-bit quantization: converted %s Linear layer(s) inside model.%s", replaced, attr)
        except Exception:
            log.exception("8-bit quantization of model.%s failed; leaving it at full precision", attr)

    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        if before_mb is not None:
            after_mb = torch.cuda.memory_allocated() / (1024 ** 2)
            log.info(
                "8-bit quantization complete: %s layer(s) converted, GPU memory %.0f MiB -> %.0f MiB",
                total_replaced, before_mb, after_mb,
            )


def ensure_model() -> None:
    global model_ready, model_error, model
    total_started = time.perf_counter()
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
            with _perf_timer("model.snapshot_download"):
                snapshot_download(
                    repo_id=MODEL_ID,
                    local_dir=str(MODEL_DIR),
                    local_dir_use_symlinks=False,
                )

        if not all(p.exists() for p in required):
            raise RuntimeError("Wan model download completed but required files are missing")

        cfg = WAN_CONFIGS["ti2v-5B"]
        log.info("Loading WanTI2V model into GPU/CPU memory")
        with _perf_timer("model.WanTI2V_init"):
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

        install_step_hook()

        if QUANTIZE_8BIT:
            log.info("WAN_QUANTIZE_8BIT=true, converting DiT weights to 8-bit before marking model ready")
            with _perf_timer("model.quantize_8bit"):
                quantize_model_8bit()

        model_ready = True
        model_error = None
        _perf_gpu_snapshot("model.ready")
        log.info(
            "PERF_MODEL_TOTAL elapsed_sec=%.3f offload_model=%s t5_cpu=%s convert_dtype=%s quantize_8bit=%s",
            time.perf_counter() - total_started,
            OFFLOAD_MODEL, T5_CPU, CONVERT_DTYPE, QUANTIZE_8BIT,
        )
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

    reporter: Optional[ProgressReporter] = None

    try:
        if not model_ready or model is None:
            raise RuntimeError(model_error or "WAN_MODEL_NOT_READY")

        clip_count = max(1, min(int(request.clip_count or 1), 60))
        reporter = ProgressReporter(request.webhook_url, external_id, clip_count, job)
        reporter.emit("PREPARING", overall=2, force=True)
        prompt_base = request.prompt.strip()
        image_path = None

        if request.image_url:
            image_path = download_image(
                request.image_url,
                workdir / "input.png",
            )

        reporter.emit("PREPARING", overall=5, force=True)

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

            def on_step(step: int, total: int, _clip: int = index + 1) -> None:
                if CANCEL_MID_STEP and event.is_set():
                    raise InterruptedError("CANCELLED")
                reporter.emit_step(_clip, step, total)

            if not _step_hook_installed:
                # No per-step hook available: at least announce the clip start.
                reporter.emit("GENERATING", clip=index + 1, within=0.0, force=True)

            with job_lock:
                _step_hook["cb"] = on_step
                try:
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
                finally:
                    _step_hook["cb"] = None

            if video is None:
                raise RuntimeError("WAN_GENERATION_RETURNED_NO_VIDEO")

            clip_path = workdir / f"clip_{index:03d}.mp4"
            reporter.emit("ENCODING", clip=index + 1, within=0.94, force=True)
            save_tensor_to_mp4(video, clip_path)
            generated.append(clip_path)
            reporter.emit("ENCODING", clip=index + 1, within=1.0, force=True)

            del video
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

        if event.is_set():
            raise InterruptedError("CANCELLED")

        final_path = workdir / "final.mp4"
        concat_mp4(generated, final_path)

        reporter.emit("UPLOADING", clip=clip_count, overall=93, force=True)
        video_url = upload_video(final_path, request.job_id)
        reporter.close()
        job["progress"] = 100
        job["stage"] = "COMPLETED"
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
        if reporter is not None:
            reporter.close()
        _step_hook["cb"] = None
        cancel_events.pop(external_id, None)
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


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
