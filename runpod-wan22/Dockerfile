FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/opt/Wan2.2 \
    WAN_REPO_DIR=/opt/Wan2.2 \
    WAN_MODEL_DIR=/workspace/models/Wan2.2-TI2V-5B \
    OUTPUT_DIR=/workspace/outputs

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 python3.10-dev python3-pip git ffmpeg curl ca-certificates \
    build-essential libgl1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/* && \
    ln -sf /usr/bin/python3.10 /usr/bin/python && \
    ln -sf /usr/bin/pip3 /usr/bin/pip

WORKDIR /opt
RUN git clone --depth 1 https://github.com/Wan-Video/Wan2.2.git /opt/Wan2.2

RUN python -m pip install --upgrade pip setuptools wheel && \
    python -m pip install \
    torch==2.4.1 torchvision==0.19.1 torchaudio==2.4.1 \
    --index-url https://download.pytorch.org/whl/cu124

# Install Wan2.2's own requirements (excluding flash-attn, which needs
# a GPU + prebuilt torch to compile — not required thanks to the SDPA fallback)
RUN grep -vi "flash.attn" /opt/Wan2.2/requirements.txt > /tmp/wan-reqs.txt && \
    python -m pip install -r /tmp/wan-reqs.txt

# Install the official Wan dependencies except flash-attn.
# Wan2.2 has an SDPA fallback when flash-attn is unavailable.
RUN python -m pip install \
    "opencv-python>=4.9.0.80" \
    "diffusers>=0.31.0" \
    "transformers>=4.49.0,<=4.51.3" \
    "tokenizers>=0.20.3" \
    "accelerate>=1.1.1" \
    tqdm "imageio[ffmpeg]" easydict ftfy dashscope imageio-ffmpeg \
    "numpy>=1.23.5,<2" \
        einops \
    decord \
    librosa \
    soundfile \
    av \
    peft \
    fastapi "uvicorn[standard]" httpx pillow huggingface_hub cloudinary

RUN python -m pip install --no-deps -e /opt/Wan2.2

COPY server.py /opt/amkaai-server/server.py
COPY requirements.txt /opt/amkaai-server/requirements.txt

RUN mkdir -p /workspace/models /workspace/outputs /workspace/jobs

WORKDIR /opt/amkaai-server

EXPOSE 8000

CMD ["python", "server.py"]