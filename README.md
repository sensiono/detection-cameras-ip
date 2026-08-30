# Système intelligent de détection — caméras IP

Three parts. `vision/` recognises, `backend/` decides and stores, `frontend/` shows.

* **`vision/`** — this document. RTSP, faces, plates. No database.
* **`backend/`** — Django REST + MySQL, the API and the reports. See [backend/README.md](backend/README.md).
* **`frontend/`** — Angular dashboard for the supervision team. See [frontend/README.md](frontend/README.md).
* **`docs/uml/`** — the five UML diagrams of §8, generated from PlantUML sources. See [docs/uml/README.md](docs/uml/README.md).
* **`training/`** — how the Tunisian OCR model was trained, and how to redo it. See [training/README.md](training/README.md).
* **`docs/machine-gpu.md`** — running the training and the evaluations on a CUDA machine.

```
caméras IP ──RTSP──► vision ──HTTP──► Django ──► MySQL
                                        ▲
                                        └──REST── Angular
```

## AI service

Standalone Python service. It reads RTSP feeds, recognises people and plates, and
POSTs events to the Django API. It never writes to MySQL directly.

```
RTSP ──► RTSPStream ──► Recognizer ──► Confirmer ──► EventSink ──► Django REST ──► MySQL
        (drops old      (face | plate)  (votes +      (HTTP)
         frames)                         cooldown)
```

## Layout

| File | Role |
|---|---|
| `stream.py` | threaded RTSP reader, always serves the newest frame (also opens a file or `0` for a webcam, so you can develop without the camera) |
| `faces/engine.py` | InsightFace detection + 512-d ArcFace embedding |
| `faces/liveness.py` | passive anti-spoofing: rejects a photo held up to the camera |
| `faces/index.py` | gallery, cosine search, `.npz` persistence |
| `faces/enroll.py` | builds the gallery from `data/photos/<user_id>/*.jpg` |
| `plates/detector.py` | YOLO plate localisation |
| `evaluate.py` | measures both models on your own photos |
| `device.py` | `gpu: true` means "if there is one", not "crash without one" |
| `plates/ocr.py` | plate-specific OCR |
| `plates/normalize.py` | canonical plate string (TN format, OCR confusions) |
| `confirm.py` | vote + cooldown, kills duplicate and one-off events |
| `pipeline.py` | wiring; `Recognizer` is the only interface to implement |
| `events.py` | `LogSink` (offline) / `HttpSink` (Django) |

## Run

```bash
pip install -e ".[dev]"

# 1. the camera URL is the only thing that has to be right first
python -m vision.cli probe cam-entrance

# 2. one folder per person, 3-5 photos each
python -m vision.cli enroll --photos data/photos

# 3. offline first: events printed, backend not needed
python -m vision.cli run cam-entrance --dry-run

# 4. live
python -m vision.cli run cam-entrance
python -m vision.cli run cam-gate

pytest
```

One process per camera (`systemd` unit or `docker compose` service each).

## Backend contract

`POST /api/events/` with `Authorization: Token <token>`:

```json
{"kind": "attendance", "camera_id": "cam-entrance", "subject": "user_42",
 "confidence": 0.71, "at": "2026-08-29T08:12:04+00:00"}
```

Three kinds: `attendance` (subject = `User.id`), `access` (subject = normalised plate)
and `unknown_face` (empty subject — a confident face matching nobody). `snapshot` is an
optional base64 JPEG crop of the detection, disabled with `runtime.snapshots: false`.

Authorisation, lateness and absence are all database decisions, so they live in Django,
not here. The full contract is in [backend/README.md](backend/README.md).

## Models

Nothing here is trained from scratch. Two files are downloaded, one is built from
your photos:

| File | Where it comes from |
|---|---|
| `models/plate_yolo.pt` | [morsetechlab/yolov11-license-plate-detection](https://huggingface.co/morsetechlab/yolov11-license-plate-detection) — `license-plate-finetune-v1s.pt`, **AGPL-3.0** |
| `models/antispoof.onnx` | a MiniFASNet ONNX (see Anti-spoofing) |
| `models/faces.npz` | built by `vision.cli enroll` from `data/photos/` |

The face and OCR models download themselves on first run (InsightFace `buffalo_l`,
fast-plate-ocr `cct-s-v2-global-model`).

```bash
curl -L -o models/plate_yolo.pt \
  https://huggingface.co/morsetechlab/yolov11-license-plate-detection/resolve/main/license-plate-finetune-v1s.pt
```

### Which Tunisian formats are parsed

Only the standard civil plate (`XXX تونس XXXX`) is *interpreted*. Every other format is
still cleaned, matched and logged — it is simply not taken apart:

| Format | Exemple | Traitement |
|---|---|---|
| Civil (et location) | `159 تونس 8950` | **analysé** → `159TN8950` |
| Régime suspensif | `RS 1234` | **analysé** → `RS1234` |
| Gouvernement | `20-130486` | nettoyé → `20130486` |
| Corps / mission diplomatique | `46 CD س د 02` | nettoyé → `46CD02` |
| Militaire, temporaire, essai | `21551`, `73141 ت ن` | nettoyé → chiffres seuls |

Rental plates are white-on-blue but carry the *same* string format, so they need no
code. Motorcycles use the standard format too — only the rear plate is mandatory, which
is a camera-placement decision, not a software one.

Refusing to parse the rest is deliberate. `46 CD 02` is digits-letters-digits, exactly
like a civil plate: accepting any letter as تونس would file a diplomatic car under the
civil plate `46TN2`. `tests/test_plate_formats.py` pins that behaviour, one test per
format.

Two formats that reduce to bare digits can in principle collide — a military `12345` and
a dealer `12345 ع ع` — but neither is parsed, so both are logged as-is and neither can
be mistaken for a civil plate.

Plate **detection** transfers across countries — a plate is a bright rectangle, and a
detector trained on European and Asian plates finds Tunisian ones without retraining.
Plate **reading** does not transfer as cleanly: the OCR was never trained on تونس, and
it transliterates that word as `TN` on one plate and `TU` on another. `normalize()`
collapses both, which is why that function exists.

Retrain the detector only if you measure it failing on your own gate footage. Fine-tuning
YOLO needs annotated boxes, not just photos — a few hundred images labelled in
[Roboflow](https://roboflow.com) or LabelImg.

> The YOLO weights are AGPL-3.0, like Ultralytics itself. Fine for an academic project;
> mention it in the report, and know that it constrains any commercial reuse.

## Measuring on your own photos

Both models are measured with two commands. Ground truth is the file name — renaming a
photo is the entire annotation process.

```bash
# data/plates/159TN8950.jpg, data/plates/159TN8950_2.jpg, ...
python -m vision.cli eval-plates --photos data/plates

# data/photos/<user_id>/*.jpg, at least 2 photos per person
python -m vision.cli eval-faces --photos data/photos
```

`eval-plates` reports detection rate and exact-read rate. `eval-faces` enrols half of
each person's photos, scores the other half, prints the FAR/FRR table and the equal-error
threshold to copy into `match_threshold`. A file whose name is not a plate (`IMG4021.jpg`)
counts as unlabelled, not as an error.

### Measured, August 2026

On 709 photographs of Tunisian cars with Pascal VOC boxes:

| | rappel | précision | IoU moyen |
|---|---|---|---|
| test (142 images) | **95.8 %** | 91.9 % | 0.837 |
| train (567 images) | **94.2 %** | 93.2 % | 0.790 |

Detection clears the > 90 % of § 7 with nothing retrained. The two published Tunisian
plate models (Roboflow Universe, `yassine-mhirsi/…-Detection`) are **detection only** —
they stop where this table stops, and neither attempts to read characters. Their > 90 %
and the OCR figures further down are not the same measurement.

### Reconnaissance faciale

`buffalo_l` (ArcFace R50, 512-d) on 200 LFW identities × 5 photos, half enrolled, half
tested — 471 genuine comparisons against 92 787 impostors:

| seuil | FAR | FRR |
|---|---|---|
| 0.30 | 0.02 % | 0.00 % |
| **0.37** | **0.00 %** | **0.00 %** |
| 0.42 | 0.00 % | 0.42 % |
| 0.50 | 0.00 % | 1.49 % |
| 0.60 | 0.00 % | 8.49 % |

The genuine and impostor distributions are fully separated: the worst impostor scores
below 0.35, the weakest genuine pair above 0.35. `match_threshold` is set to **0.37**,
in the middle of that gap.

**Ce 100 % ne dit pas que le système est parfait.** LFW is frontal, well lit and
photographed by professionals, and ArcFace is near-saturated on it (état de l'art
99,8 %). A gate camera gives angles, motion blur and night IR that LFW contains none
of. The number validates the *threshold*, not the deployment — re-run `eval-faces` on
photos from your own camera before quoting anything from this table in the report.

On 900 cropped Tunisian plates, 29 of them transcribed by hand as ground truth:

| | |
|---|---|
| plaque exacte | **6.9 %** |
| tous les chiffres corrects | 17.2 % |
| série + numéro récupérés par extraction | 34.5 % |

**The OCR was the bottleneck, and it was not a tuning problem.** `cct-s-v2-global-model`
was never trained on تونس: it renders the word as `P`, `J`, `C`, or as extra digits, and
those spurious characters push real digits past the model's 10-slot output. In 900 crops
it produced the canonical `NNNTNNNN` form exactly **zero** times.

### Trained on Tunisian plates

`models/tn_ocr.onnx` is trained from scratch on Tunisian plates — the § 11 deliverable
(« modèle IA entraîné »). 300 crops hand-labelled, split **by plate**, plus 12 000
synthetic plates composed from real Tunisian glyphs. See [training/README.md](training/README.md).

| Jeu de test réel (51 images, 45 plaques) | global | entraîné |
|---|---|---|
| plaque exacte | **0.0 %** | **82.4 %** |
| caractères corrects | — | **97.5 %** |
| plaque reconnue sur au moins une photo | — | 84.4 % |

Le point de comparaison est honnête : même jeu, jamais vu à l'entraînement, et le
point de contrôle est choisi sur la validation, pas sur le test.

Quatre réserves à écrire dans le rapport plutôt qu'à taire :

* 51 images, c'est ±2 % par image. Un écart de trois ou quatre points entre deux
  points de contrôle est du bruit, pas un progrès. Le point de contrôle retenu est
  celui qui maximise l'exactitude sur la **validation** (88,5 %, époque 42 sur 60) ;
  le 82,4 % ci-dessus est son score sur le test, mesuré une seule fois.
* Le modèle est spécialisé. Sur deux photographies atypiques (plaque à pastille
  latine « TN », cadrage large) il se trompe d'un chiffre là où le modèle global
  tombait juste. Il faut le réévaluer sur les images de votre propre portail.
* Sur les 9 erreurs du test, 3 sont un chiffre ajouté en fin de plaque (`147TN472`
  lu `147TN4721`). Les étiquettes ont été revérifiées sur les découpes : elles sont
  justes, le modèle **complète les groupes de 3 chiffres en groupes de 4**. C'est un
  biais systématique, pas du bruit : les groupes à 3 chiffres ne représentent que
  10,3 % des plaques réelles (et 10 % des synthétiques — le générateur est fidèle),
  donc le modèle a appris un a priori fort vers 4 chiffres et y retombe dès que le
  dernier caractère est marginal. Le correctif est de **sur**-représenter les plaques
  à 3 chiffres dans le jeu synthétique, au-delà de leur fréquence réelle, pour que le
  cas rare reçoive assez de gradient. C'est le prochain gain le moins cher.
* Une découpe du test (`46.jpg`) est tronquée au bord droit — le dernier chiffre est
  coupé et le cadre blanc de la plaque ne s'y referme pas. Ni l'étiquette ni la
  prédiction n'y sont vérifiables ; elle est comptée comme erreur, ce qui est le choix
  prudent.

```bash
# 1. label the crops — the page pre-fills each box with the current model's guess
python -m vision.cli label --photos data/plates_crops

# 2. fine-tune (labels.csv is image_path,plate_text)
pip install "fast-plate-ocr[train]"
fast-plate-ocr train --annotations labels.csv ...

# 3. measure again
python -m vision.cli eval-plates --photos data/plates
```

## Anti-spoofing

Face recognition alone cannot tell a person from a photo of that person — that is not a
bug in ArcFace, it is what ArcFace is for. Without a liveness check, anyone marks a
colleague present with a phone.

`faces/liveness.py` scores each detected face before the gallery is consulted, and a face
below `liveness.threshold` produces a `spoof_attempt` event instead of an attendance one.
The gallery is never even queried: a spoof must not be able to reach an identity.

`models/antispoof.onnx` is **MiniFASNet-V2 2.7_80x80** (Apache-2.0, minivision-ai/
Silent-Face-Anti-Spoofing), converted from the upstream `.pth` by
[training/convert_antispoof.py](training/convert_antispoof.py) — sha256 of the source
weights `a5eb02e1…`, so the provenance is checkable rather than trusted. The context crop
(`scale: 2.7`) is deliberately wider than the face, because the evidence of a spoof is at
the edge: the phone bezel, the paper border, the moiré of a screen.

Measured on the three labelled samples shipped by the upstream repository:

| image | vérité | score de vivacité | verdict à 0.60 |
|---|---|---|---|
| `image_T1` | réel | **0.9999** | accepté |
| `image_F1` | attaque | 0.0063 | rejeté |
| `image_F2` | attaque | 0.0010 | rejeté |

Three images is a demonstration, not a measurement — build your own attack set before
quoting a rate. On 120 LFW faces, 90 % pass the 0.60 threshold; the 10 % that fail are
an artefact of LFW being pre-cropped to 250×250, which leaves none of the surrounding
context the model needs. That is worth knowing as a property of the model: **it degrades
when the frame is tight**, so mount the camera to see more than a face.

Two traps this model sets, both silent, both found the hard way:

* **The input is raw 0-255, never `/255`.** Scaled to [0, 1] the network saturates and
  returns the same class with p ≈ 0.994 for every input — pure noise included. It still
  looks like a working liveness gate, and it accepts nothing and rejects nothing on merit.
* **The live class is index 1**, per upstream's own `test.py`. The HuggingFace card of the
  published ONNX export documents `[live, print, replay]` with live at 0; that is wrong,
  and following it inverts the gate — real faces rejected, photos accepted.

If the file is missing the service refuses to start rather than starting without the
check. Setting `liveness.enabled: false` is a deliberate decision to accept the risk —
state it in the report, don't leave it silent.

## Thresholds

`match_threshold` (0.37, measured), `min_det_score` (0.60) and `liveness.threshold` (0.60) are the
numbers that decide accuracy. Tune them on your own validation set: enrol half the photos,
score the other half, plot FAR/FRR and pick the operating point. For liveness, build the
attack set yourself — print ten enrolled faces, replay ten more on a phone, and measure how
many get through. That curve, and that table, are a chapter of the report each.
