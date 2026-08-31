from __future__ import annotations

from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field


class CameraCfg(BaseModel):
    id: str
    url: str | int
    task: Literal["attendance", "anpr"]



class LivenessCfg(BaseModel):
    enabled: bool = True
    model: Path = Path("models/antispoof.onnx")
    scale: float = 2.7        # context crop around the face, per model variant
    threshold: float = 0.60   # below this, the face is treated as a spoof


class FacesCfg(BaseModel):
    model: str = "buffalo_l"
    det_size: int = 640
    min_det_score: float = 0.60
    match_threshold: float = 0.42
    index_path: Path = Path("models/faces.npz")
    liveness: LivenessCfg = Field(default_factory=LivenessCfg)


class PlatesCfg(BaseModel):
    weights: Path = Path("models/plate_yolo.pt")
    conf: float = 0.35
    # Either a hub model name, or a path to an .onnx trained on your own plates.
    ocr_model: str = "cct-s-v2-global-model"
    # Required only for a local .onnx: the YAML describing its alphabet and input.
    ocr_config: Path | None = None


class ConfirmCfg(BaseModel):
    votes: int = 3
    window_s: float = 5.0
    cooldown_s: float = 300.0


class SinkCfg(BaseModel):
    url: str
    token: str
    timeout_s: float = 5.0


class RuntimeCfg(BaseModel):
    gpu: bool = True
    frame_stride: int = 3
    snapshots: bool = True  # attach the crop to each event; off = less data stored


class Config(BaseModel):
    cameras: list[CameraCfg]
    faces: FacesCfg = Field(default_factory=FacesCfg)
    plates: PlatesCfg = Field(default_factory=PlatesCfg)
    confirm: ConfirmCfg = Field(default_factory=ConfirmCfg)
    sink: SinkCfg
    runtime: RuntimeCfg = Field(default_factory=RuntimeCfg)

    @classmethod
    def load(cls, path: str | Path = "config.yaml") -> "Config":
        return cls.model_validate(yaml.safe_load(Path(path).read_text()))
