FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# System dependencies for OpenCV, FFmpeg, and networking
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    curl \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch and numpy
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir "numpy<2.0.0,>=1.26.4"

# Install vision service
COPY pyproject.toml .
COPY vision vision/
COPY training training/
COPY models models/
COPY config.yaml .

RUN pip install --no-cache-dir . pyarrow typer

# Default camera ID can be overridden via environment or CMD
ENV CAMERA_ID=cam-entrance

CMD ["sh", "-c", "python -m vision.cli run $CAMERA_ID"]
