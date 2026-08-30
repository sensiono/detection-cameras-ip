"""Convert the upstream MiniFASNet-V2 anti-spoofing weights to ONNX.

Converting from the published `.pth` rather than trusting a third-party ONNX means the
provenance is checkable: the weights hash below is the one in the upstream repository.

    .venv-train/bin/pip install torch onnxscript
    .venv-train/bin/python training/convert_antispoof.py \
        --weights 2.7_80x80_MiniFASNetV2.pth --arch MiniFASNet.py --out models/antispoof.onnx

**The input is raw 0-255 BGR, never divided by 255.** MiniFASNet's batch-norm running
statistics were fitted on that domain; in [0, 1] the network saturates and returns
class 2 with p ~ 0.994 for *every* input, pure noise included. That failure is silent
and looks like a working model, so `--check` below refuses to write a file that does it.

Class order is [attaque 2D, réel, autre attaque]: index 1 is the live face, matching
upstream's `test.py` (`if label == 1: "Real Face"`). The HuggingFace card of the
published ONNX export states [live, print, replay] instead; that is wrong.

Weights (Apache-2.0, minivision-ai/Silent-Face-Anti-Spoofing):
  resources/anti_spoof_models/2.7_80x80_MiniFASNetV2.pth
  sha256 a5eb02e1843f19b5386b953cc4c9f011c3f985d0ee2bb9819eea9a142099bec0
"""

from __future__ import annotations

import argparse
import importlib.util
import pathlib
import sys

import torch


def load_arch(path: pathlib.Path):
    spec = importlib.util.spec_from_file_location("minifasnet", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules["minifasnet"] = module
    spec.loader.exec_module(module)
    return module


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--weights", required=True)
    ap.add_argument("--arch", required=True, help="MiniFASNet.py from the upstream repo")
    ap.add_argument("--out", default="models/antispoof.onnx")
    args = ap.parse_args()

    arch = load_arch(pathlib.Path(args.arch))
    model = arch.MiniFASNetV2(embedding_size=128, conv6_kernel=(5, 5),
                              drop_p=0.2, num_classes=3, img_channel=3)

    state = torch.load(args.weights, map_location="cpu", weights_only=True)
    # Upstream checkpoints were saved from a DataParallel wrapper.
    if next(iter(state)).startswith("module."):
        state = {k[len("module."):]: v for k, v in state.items()}
    missing, unexpected = model.load_state_dict(state, strict=False)
    assert not missing, f"poids manquants : {missing[:5]}"
    assert not unexpected, f"poids inattendus : {unexpected[:5]}"

    # The whole point. Without it BatchNorm normalises by the batch instead of by the
    # running statistics, and a batch of one collapses to a constant output.
    model.eval()

    dummy = torch.randn(1, 3, 80, 80) * 255

    # A constant model is the failure mode that matters, and it hides: it still loads,
    # still returns three plausible probabilities, and still gates every face the same
    # way. Feed inputs that must disagree and require that they do.
    with torch.no_grad():
        dark = model(torch.zeros(1, 3, 80, 80))
        bright = model(torch.full((1, 3, 80, 80), 255.0))
    spread = (torch.softmax(dark, 1) - torch.softmax(bright, 1)).abs().max().item()
    assert spread > 0.10, (
        f"sorties quasi identiques (écart max {spread:.4f}) : le modèle ignore son "
        "entrée, conversion inutilisable"
    )

    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    torch.onnx.export(
        model, dummy, str(out), opset_version=11,
        input_names=["input"], output_names=["output"],
        dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
    )

    # torch's exporter spills weights into a `.onnx.data` sidecar. A model that only
    # works when a second file happens to be next to it is a deployment trap, and the
    # whole thing is under 2 MB -- fold the weights back in and ship one file.
    import onnx

    onnx.save(
        onnx.load(str(out)), str(out),
        save_as_external_data=False, all_tensors_to_one_file=True,
    )
    sidecar = out.with_suffix(".onnx.data")
    sidecar.unlink(missing_ok=True)

    import numpy as np
    import onnxruntime as ort

    session = ort.InferenceSession(str(out), providers=["CPUExecutionProvider"])
    name = session.get_inputs()[0].name
    with torch.no_grad():
        expected = model(dummy).numpy()
    got = session.run(None, {name: dummy.numpy()})[0]
    assert np.allclose(expected, got, atol=1e-4), "ONNX diverge du modèle PyTorch"

    z = session.run(None, {name: np.zeros((1, 3, 80, 80), np.float32)})[0]
    o = session.run(None, {name: np.full((1, 3, 80, 80), 255.0, np.float32)})[0]
    assert np.abs(z - o).max() > 0.10, "ONNX constant : export raté"

    print(f"{out} écrit, {out.stat().st_size / 1e6:.2f} Mo — sorties vérifiées non constantes")


if __name__ == "__main__":
    main()
