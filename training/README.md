# Fine-tuning de l'OCR sur plaques tunisiennes

Le modèle OCR global lit les plaques tunisiennes à **0 %** (exact) : il n'a jamais vu
تونس et écrit `J`, `P` ou `C` à la place, ce qui décale les chiffres réels hors des dix
emplacements de sortie. Ce dossier contient de quoi l'entraîner sur le format tunisien.
C'est le livrable « modèle IA entraîné » du § 11 du cahier des charges.

## Contenu

| Fichier | Rôle |
|---|---|
| `tn_plate_config.yaml` | alphabet et format d'entrée — **13 classes** au lieu de 37 |
| `cct_xs_v2.yaml` | architecture (CCT-XS, la plus petite de fast-plate-ocr) |
| `make_synthetic.py` | génère des plaques synthétiques à partir de pixels réels |
| `labels/all.csv` | **300 plaques étiquetées à la main** |
| `labels/{train,val,test}.csv` | découpage **par plaque**, jamais par image |

Les images ne sont pas versionnées (jeu Kaggle, licence tierce) ; seuls les
étiquetages, qui sont le travail réel, le sont.

## Les trois décisions qui comptent

**L'alphabet est réduit à `0123456789TN_`.** Le modèle global échouait en partie parce
que rien ne l'empêchait d'inventer une lettre à la place de تونس. Treize classes, c'est
aussi ce qui rend l'apprentissage possible avec quelques centaines de plaques.

**Le découpage se fait par plaque.** 35 des 300 photos montrent une voiture déjà
présente ailleurs dans le jeu. Découper par image mettrait la même plaque dans
l'entraînement et dans le test : le score mesurerait la mémorisation.

**Les plaques synthétiques sont faites de pixels réels.** Les chiffres proviennent du
jeu de chiffres découpés sur de vraies plaques tunisiennes, le mot تونس de photographies.
Rien n'est dessiné avec une police approchante : chaque pixel a été sur une voiture.

## Reproduire

```bash
# environnement séparé : TensorFlow n'a pas de roue pour Python 3.14
brew install python@3.12
python3.12 -m venv .venv-train
.venv-train/bin/pip install "fast-plate-ocr[train]" onnxruntime

# 1. plaques synthétiques (le mot et les chiffres viennent de vraies plaques)
python training/make_synthetic.py --digits DIGITS_DIR --words WORDS_DIR \
    --out data/train_data -n 12000

# 2. entraînement — validation sur les plaques réelles, jamais sur les synthétiques
.venv-train/bin/fast-plate-ocr train \
  --model-config-file training/cct_xs_v2.yaml \
  --plate-config-file training/tn_plate_config.yaml \
  --annotations data/train_data/train_mixed.csv \
  --val-annotations training/labels/val.csv \
  --output-dir runs/tn --epochs 60 --early-stopping-patience 20

# 3. export ONNX puis mise en service
.venv-train/bin/fast-plate-ocr export -m runs/tn/<run>/best.keras -f onnx \
  --plate-config-file training/tn_plate_config.yaml --save-dir models
```

Le run livré a tourné les 60 époques (pas d'arrêt anticipé). Son journal complet est
dans [training_log.csv](training_log.csv) : l'exactitude de validation plafonne à
**88,5 %** à l'époque 42, et `best.keras` est ce point-là. Les époques suivantes
gagnent encore en entraînement (97 %) sans gagner en validation — c'est le début du
surapprentissage, et la raison pour laquelle on sélectionne sur la validation.

Puis dans `config.yaml` :

```yaml
plates:
  ocr_model: models/tn_ocr.onnx
  ocr_config: training/tn_plate_config.yaml
```

## Étiqueter davantage

600 des 900 découpes restent à étiqueter. La page pré-remplie évite de tout taper :

```bash
python -m vision.cli label --photos data/plates_crops
```
