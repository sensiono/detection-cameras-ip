# Entraîner et évaluer sur la machine GPU

Tout le projet tourne sur un portable ; seuls l'entraînement OCR et les évaluations
lourdes gagnent vraiment à passer sur la RTX 4090. Le reste (backend, frontend,
lecture d'une caméra) n'a aucune raison de changer de machine.

Ce qui change, et de combien :

| tâche | Mac (CPU) | i9 + RTX 4090 | intérêt |
|---|---|---|---|
| entraînement OCR, 60 époques | ~3 h | **~10 min** | énorme |
| `eval-faces`, 1 000 photos | 17 min | **~40 s** | net |
| `eval-detection`, 709 photos | ~6 min | ~30 s | net |
| `eval-plates` (ONNX, 3 Mo) | 26 ms/image | ~5 ms/image | inutile |
| backend / frontend | — | — | **aucun** |

L'OCR entraîné fait 3 Mo et tourne en 26 ms sur un CPU : il n'a pas besoin de GPU en
production. Le GPU sert à *fabriquer* le modèle, pas à s'en servir.

## Ce qu'il faut copier

Le dépôt sans les poids ni les images :

```bash
rsync -av --exclude .venv --exclude .venv-train --exclude models \
      --exclude data --exclude node_modules \
      "ai detection/" user@pc-gpu:~/ai-detection/
```

Puis, séparément, les jeux d'images (ils ne sont pas dans le dépôt) :
`data/train_data/`, `data/faces_lfw/`, et le dossier de découpes de plaques.

Les étiquettes, elles, **sont** dans le dépôt : `training/labels/*.csv`. C'est le
travail qu'il ne faut surtout pas perdre.

## Installation sur le PC GPU

Vérifier d'abord le pilote — c'est la seule chose qui casse silencieusement :

```bash
nvidia-smi
```

Il faut une ligne `CUDA Version: 12.x`. Sinon, installer le pilote NVIDIA avant
toute autre chose ; aucun paquet Python ne rattrape un pilote absent.

```bash
# TensorFlow n'a pas de roue pour Python 3.14 : l'environnement d'entraînement
# reste en 3.12, exactement comme sur le Mac.
python3.12 -m venv .venv-train
.venv-train/bin/pip install "fast-plate-ocr[train]" onnxruntime-gpu pyarrow

# environnement de service (inférence, CLI) — Python 3.12 convient aussi
python3.12 -m venv .venv
.venv/bin/pip install -e .
.venv/bin/pip uninstall -y onnxruntime && .venv/bin/pip install onnxruntime-gpu
```

`onnxruntime-gpu`, pas `onnxruntime` : les deux s'installent sans erreur et le
mauvais tourne sur le CPU **sans rien dire**. C'est le piège le plus courant.

Sous Linux, TensorFlow veut aussi les bibliothèques CUDA :

```bash
.venv-train/bin/pip install "tensorflow[and-cuda]"
```

### Vérifier que le GPU est réellement pris

Ne pas sauter cette étape : un entraînement qui tombe sur le CPU met 3 h au lieu de
10 min et ne le signale nulle part.

```bash
.venv-train/bin/python -c "
import tensorflow as tf
gpus = tf.config.list_physical_devices('GPU')
print('GPU TensorFlow :', gpus)
assert gpus, 'TensorFlow ne voit pas le GPU'
"
.venv/bin/python -c "
import onnxruntime as ort
p = ort.get_available_providers()
print('providers ONNX :', p)
assert 'CUDAExecutionProvider' in p, 'onnxruntime-gpu absent ou mal installé'
"
```

Côté service, `config.yaml` a déjà `runtime.gpu: true`, et `vision/device.py`
bascule sur le CPU en journalisant `aucun GPU CUDA détecté` s'il n'y a rien. Si ce
message apparaît sur le PC GPU, c'est que l'installation est fausse — pas que le
code se protège utilement.

## Les commandes, dans l'ordre

### 1. Plaques synthétiques

```bash
.venv-train/bin/python training/make_synthetic.py \
    --digits DIGITS_DIR --words WORDS_DIR --out data/train_data -n 12000
```

CPU uniquement (composition d'images), ~2 min. Le GPU n'y change rien.

### 2. Entraînement OCR

```bash
.venv-train/bin/fast-plate-ocr train \
  --model-config-file training/cct_xs_v2.yaml \
  --plate-config-file training/tn_plate_config.yaml \
  --annotations data/train_data/train_mixed.csv \
  --val-annotations data/train_data/val.csv \
  --output-dir runs/tn --epochs 60 --early-stopping-patience 20
```

**La validation se fait sur les plaques réelles, jamais sur les synthétiques** —
sinon on mesure la qualité du générateur, pas celle du modèle. Le point de contrôle
`best.keras` est choisi sur `val_acc`.

Avec 10 minutes par run au lieu de 3 heures, la vraie occasion est d'essayer
plusieurs configurations plutôt qu'une seule. Ce qui vaut le coup :

* `--epochs 150` — sur le Mac, 60 époques était une contrainte de temps, pas un
  optimum. Le journal montre la validation qui plafonne à l'époque 42 sur 60, donc
  150 ne changera peut-être rien, mais c'est enfin mesurable.
* `-n 40000` plutôt que 12 000 synthétiques.
* Trois graines différentes, pour savoir si l'écart entre deux runs est du signal ou
  du bruit — question qu'on ne peut pas trancher aujourd'hui.

### 3. Export ONNX

```bash
.venv-train/bin/fast-plate-ocr export -m runs/tn/<run>/best.keras -f onnx \
  --plate-config-file training/tn_plate_config.yaml --save-dir models
mv models/best.onnx models/tn_ocr.onnx
```

Le `.onnx` produit est portable : on le recopie sur le Mac et il y tourne sur CPU.
C'est le seul fichier à rapatrier.

### 4. Évaluations

```bash
.venv/bin/python -m vision.cli eval-plates    --photos data/train_data/test
.venv/bin/python -m vision.cli eval-detection --photos DOSSIER_VOC
.venv/bin/python -m vision.cli eval-faces     --photos data/faces_lfw
```

`eval-faces` télécharge InsightFace `buffalo_l` (289 Mo) au premier lancement. Si le
téléchargement échoue en `SSLCertVerificationError` :

```bash
export SSL_CERT_FILE=$(python -c "import certifi; print(certifi.where())")
```

## Ce qui ne doit pas bouger

* **Les découpages train/val/test.** Ils sont figés dans `training/labels/*.csv` et
  séparés **par plaque**, pas par image — 35 des 300 photos montrent une voiture qui
  réapparaît ailleurs. Régénérer un découpage aléatoire sur le PC GPU mettrait la
  même plaque des deux côtés et gonflerait le score sans rien améliorer.
* **Le choix du point de contrôle sur la validation.** Prendre celui qui note le
  mieux sur le test, c'est sélectionner sur le test : le chiffre publié n'est alors
  plus une mesure.
* **`training/tn_plate_config.yaml`.** L'alphabet à 13 classes est ce qui empêche le
  modèle d'écrire `J` ou `P` à la place de تونس. Un modèle exporté avec une autre
  configuration ne se chargera pas côté service.
