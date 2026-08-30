from __future__ import annotations

import logging

log = logging.getLogger(__name__)


def use_gpu(requested: bool) -> bool:
    """True only when the GPU is both asked for and actually present.

    `gpu: true` means "use the GPU if there is one", not "fail without one". The
    same config has to run on a CUDA server and on the laptop used for the demo,
    and a stack trace at the gate is a worse outcome than a slower frame rate.
    """
    if not requested:
        return False
    try:
        import torch

        if torch.cuda.is_available():
            return True
    except ImportError:
        try:
            import onnxruntime as ort

            if "CUDAExecutionProvider" in ort.get_available_providers():
                return True
        except ImportError:
            pass
    log.warning("aucun GPU CUDA détecté : bascule sur le CPU")
    return False
