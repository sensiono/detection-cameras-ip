from __future__ import annotations

import logging
from pathlib import Path

import typer

from .config import Config
from .events import HttpSink, LogSink
from .stream import RTSPStream

# Model classes are imported inside each command on purpose: importing torch and
# onnxruntime costs seconds, and `probe` or an ANPR-only machine should not pay for
# InsightFace it will never load.

log = logging.getLogger(__name__)

app = typer.Typer(add_completion=False, help="AI service for cameras")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@app.command()
def enroll(photos: str = "data/photos", config: str = "config.yaml") -> None:
    """Build the face gallery from data/photos/<user_id>/*.jpg."""
    from .faces.engine import FaceEngine
    from .faces.enroll import enroll_directory

    cfg = Config.load(config)
    index = enroll_directory(FaceEngine(cfg.faces, cfg.runtime.gpu), photos)
    index.save(cfg.faces.index_path)
    typer.echo(f"enrolled {len(index.labels)} identities -> {cfg.faces.index_path}")


@app.command()
def run(camera_id: str, config: str = "config.yaml", dry_run: bool = False) -> None:
    """Run one camera pipeline."""
    from .pipeline import AnprRecognizer, AttendanceRecognizer, run_camera

    cfg = Config.load(config)
    camera = next(c for c in cfg.cameras if c.id == camera_id)
    sink = LogSink() if dry_run else HttpSink(cfg.sink)

    if camera.task == "attendance":
        from .faces.engine import FaceEngine
        from .faces.index import FaceIndex
        from .faces.liveness import LivenessChecker

        live = cfg.faces.liveness
        recognizer = AttendanceRecognizer(
            FaceEngine(cfg.faces, cfg.runtime.gpu),
            FaceIndex.load(cfg.faces.index_path),
            cfg.faces.match_threshold,
            LivenessChecker(live.model, live.scale, cfg.runtime.gpu) if live.enabled else None,
            live.threshold,
        )
        if not live.enabled:
            log.warning("anti-spoofing désactivé : une photo imprimée suffit pour pointer")
    else:
        from .plates.detector import PlateDetector
        from .plates.ocr import PlateOCR

        recognizer = AnprRecognizer(
            PlateDetector(cfg.plates, cfg.runtime.gpu),
            PlateOCR(cfg.plates.ocr_model, cfg.runtime.gpu, cfg.plates.ocr_config),
        )
    run_camera(camera, recognizer, sink, cfg)


@app.command("run-all")
def run_all(config: str = "config.yaml", dry_run: bool = False) -> None:
    """Run all configured camera pipelines simultaneously in parallel threads."""
    import threading
    import time

    cfg = Config.load(config)
    typer.echo(f"Lancement de {len(cfg.cameras)} caméras en parallèle...")

    threads: list[threading.Thread] = []
    for camera in cfg.cameras:
        t = threading.Thread(
            target=run,
            args=(camera.id,),
            kwargs={"config": config, "dry_run": dry_run},
            daemon=True,
            name=f"thread-{camera.id}",
        )
        t.start()
        threads.append(t)
        time.sleep(0.5)

    try:
        while True:
            time.sleep(1.0)
    except KeyboardInterrupt:
        typer.echo("Arrêt de tous les flux caméras.")


@app.command()

def probe(camera_id: str, config: str = "config.yaml", seconds: float = 5.0) -> None:
    """Check a camera URL: resolution and measured FPS. Run this before anything else."""
    import time

    cfg = Config.load(config)
    camera = next(c for c in cfg.cameras if c.id == camera_id)
    with RTSPStream(camera.url) as stream:
        start, shape, n = time.monotonic(), None, 0
        for frame in stream.frames():
            shape = frame.shape
            n += 1
            if time.monotonic() - start >= seconds:
                break
    if not n:  # wrong URL, credentials, or a codec ffmpeg cannot open
        typer.echo(f"no frame from {camera.url}", err=True)
        raise typer.Exit(1)
    typer.echo(f"{camera.id}: {shape[1]}x{shape[0]}, {n / seconds:.1f} fps")



@app.command("eval-plates")
def eval_plates(photos: str = "data/plates", config: str = "config.yaml") -> None:
    """Measure ANPR on your own photos. Name each file after the plate it shows —
    `159TN8950.jpg`, or `159TN8950_2.jpg` for a second shot of the same car."""
    from .evaluate import evaluate_plates
    from .plates.detector import PlateDetector
    from .plates.ocr import PlateOCR

    cfg = Config.load(config)
    results = evaluate_plates(
        PlateDetector(cfg.plates, cfg.runtime.gpu),
        PlateOCR(cfg.plates.ocr_model, cfg.runtime.gpu, cfg.plates.ocr_config),
        photos,
    )
    if not results:
        typer.echo(f"aucune image dans {photos}", err=True)
        raise typer.Exit(1)

    for r in results:
        verdict = "  " if r.expected is None else ("OK" if r.correct else "KO")
        typer.echo(
            f"{verdict} {r.path.name:28s} lu={str(r.read):14s} "
            f"attendu={str(r.expected):14s} conf={r.confidence:.3f}"
        )

    labelled = [r for r in results if r.expected is not None]
    detected = sum(r.detected for r in results)
    typer.echo(f"\ndétection : {detected}/{len(results)} images")
    if labelled:
        correct = sum(r.correct for r in labelled)
        typer.echo(f"lecture exacte : {correct}/{len(labelled)} images étiquetées")
    else:
        typer.echo("aucune image étiquetée : renommez-les d'après leur plaque pour mesurer")


@app.command("eval-faces")
def eval_faces(photos: str = "data/photos", config: str = "config.yaml") -> None:
    """Measure face recognition and pick `match_threshold` from your own faces.

    Enrols half of each person's photos and scores the other half: testing on the
    photos you enrolled would report a meaningless 100%.
    """
    from .evaluate import score_gallery
    from .faces.engine import FaceEngine

    cfg = Config.load(config)
    scores = score_gallery(FaceEngine(cfg.faces, cfg.runtime.gpu), photos)
    if not scores.genuine.size:
        typer.echo("pas assez de photos : il en faut au moins 2 par personne", err=True)
        raise typer.Exit(1)

    typer.echo(f"{scores.genuine.size} comparaisons légitimes, {scores.impostor.size} imposteurs\n")
    typer.echo(f"{'seuil':>7} {'FAR':>8} {'FRR':>8}")
    for threshold in [0.30, 0.35, 0.40, 0.42, 0.45, 0.50, 0.55, 0.60]:
        far, frr = scores.rates(threshold)
        typer.echo(f"{threshold:7.2f} {far:7.2%} {frr:7.2%}")

    best, far, frr = scores.best_threshold()
    typer.echo(f"\npoint d'égale erreur : seuil {best:.2f} (FAR {far:.2%}, FRR {frr:.2%})")
    typer.echo(f"précision à ce seuil : {1 - (far + frr) / 2:.2%}")
    typer.echo("Reportez ce seuil dans config.yaml sous faces.match_threshold.")



@app.command("eval-detection")
def eval_detection(
    photos: str = "data/plates", config: str = "config.yaml", iou: float = 0.5
) -> None:
    """Score plate *detection* against Pascal VOC .xml boxes next to each image."""
    from .evaluate import evaluate_detection
    from .plates.detector import PlateDetector

    cfg = Config.load(config)
    totals, misses = evaluate_detection(
        PlateDetector(cfg.plates, cfg.runtime.gpu), photos, iou
    )
    if not totals.images:
        typer.echo(f"aucune image annotée (.xml) dans {photos}", err=True)
        raise typer.Exit(1)

    typer.echo(f"images       : {totals.images}")
    typer.echo(f"plaques      : {totals.truth} attendues, {totals.predicted} détectées")
    typer.echo(f"rappel       : {totals.recall:.2%}   (plaques trouvées — ce qui compte au portail)")
    typer.echo(f"précision    : {totals.precision:.2%}   (détections justes)")
    typer.echo(f"IoU moyen    : {totals.mean_iou:.3f}   (qualité du cadrage, seuil {iou})")
    if misses:
        typer.echo(f"\n{len(misses)} image(s) avec une plaque manquée : {', '.join(misses[:12])}"
                   + (" ..." if len(misses) > 12 else ""))



@app.command("label")
def label(photos: str = "data/plates", config: str = "config.yaml") -> None:
    """Write an HTML page to label cropped plates, pre-filled by the current model.

    Produces the `image_path,plate_text` CSV that fine-tuning needs. Open the page in
    a browser, correct what is wrong, download the CSV.
    """
    import cv2

    from .evaluate import images_in, read_image
    from .label import build_page, guess
    from .plates.ocr import PlateOCR

    cfg = Config.load(config)
    ocr = PlateOCR(cfg.plates.ocr_model, cfg.runtime.gpu, cfg.plates.ocr_config)
    paths = images_in(photos)
    if not paths:
        typer.echo(f"aucune image dans {photos}", err=True)
        raise typer.Exit(1)

    entries = []
    with typer.progressbar(paths, label="pré-remplissage") as progress:
        for path in progress:
            image = read_image(path)
            if image is None:
                continue

            h, w = image.shape[:2]
            raw, _ = ocr.read(image, (0, 0, w, h), pad=0)
            entries.append((path.name, guess(raw or "")))

    page = build_page(entries, Path(photos) / "labels.html", "Étiquetage des plaques")
    prefilled = sum(1 for _, value in entries if value)
    typer.echo(f"\n{page}  —  {prefilled}/{len(entries)} cases pré-remplies")
    typer.echo("Ouvrez la page, corrigez, puis « Télécharger labels.csv ».")


if __name__ == "__main__":
    app()
