# Système Intelligent de Détection & Supervision par Caméras IP

Plateforme complète de vision par ordinateur pour la gestion automatisée du **pointage biométrique** (reconnaissance faciale et vivacité) et du **contrôle d'accès des véhicules** (lecture automatique de plaques d'immatriculation tunisiennes — ANPR).

Le projet est architecturé en trois sous-systèmes indépendants et découplés :
* **`vision/`** — Service IA autonome en Python : lecture des flux RTSP, détection faciale, vivacité, OCR de plaques tunisiennes, vote temporel multi-trames et file d'attente locale SQLite (Store-and-Forward).
* **`backend/`** — API Django REST Framework + MySQL 8.4 LTS : gestion des présences, des retards, des autorisations de véhicules (Whitelist), des alertes en temps réel et génération des rapports (Excel / PDF).
* **`frontend/`** — Tableau de bord moderne en Angular 20 : supervision en temps réel des flux, consultation des passages avec captures photographiques et gestion des accès.

---

## 1. Architecture Globale

```
Caméras IP (RTSP) ──► Service Vision (IA) ──HTTP (Événements)──► Backend Django REST ──► Base MySQL 8.4
                            │                                            ▲
                 File d'attente SQLite                                   │ API REST (JWT)
                  (Store-and-Forward)                           Dashboard Angular 20
```

### Flux de Traitement IA (`vision/`)

```
Flux RTSP ──► RTSPStream ──► Détecteur / Reconnaissance ──► Vote & Consensus ──► File d'attente ──► API Django
              (Décodage      (Visage ArcFace R50 ou        (Consensus OCR &      (SQLite locale      (POST /api/events/)
               asynchrone)    Plaque YOLOv11 + OCR TN)      Anti-rebond)          auto-flusher)
```

---

## 2. Organisation du Code Source

| Répertoire / Fichier | Description & Rôle |
|---|---|
| `vision/stream.py` | Gestionnaire de flux RTSP multithread avec saut de trame adaptatif sur détection de mouvement. |
| `vision/faces/engine.py` | Moteur de détection faciale InsightFace et extraction des descripteurs ArcFace 512-d. |
| `vision/faces/liveness.py` | Détecteur de vivacité passif MiniFASNet-V2 rejetant les tentatives d'usurpation (photos/écrans). |
| `vision/faces/index.py` | Galerie d'identités, recherche cosinus vectorielle et persistance `.npz`. |
| `vision/faces/enroll.py` | Enrôlement automatique des visages depuis le dossier `data/photos/<identifiant>/*.jpg`. |
| `vision/plates/detector.py` | Détection et localisation des plaques d'immatriculation avec YOLOv11. |
| `vision/plates/ocr.py` | Prétraitement contrastif CLAHE et reconnaissance optique (Fast-Plate-OCR 13 classes). |
| `vision/plates/normalize.py` | Normalisation canonique des plaques tunisiennes et correction des confusions de caractères. |
| `vision/pipeline.py` | Pipeline d'inférence unifié et voteur de consensus temporel multi-trames (`PlateTemporalVoter`). |
| `vision/events.py` | Émetteurs d'événements : `LogSink` (mode hors-ligne) et `HttpSink` avec file d'attente persistante SQLite. |
| `backend/` | Application Django 5.1 (modèles, authentification JWT/Token, API REST, alertes Telegram/Webhook, exports, purge INPDP). |
| `frontend/` | Application Angular 20 (tableau de bord temps réel, design moderne, graphiques et tables réactives). |
| `training/` | Scripts de génération synthétique et d'entraînement du modèle OCR tunisien. |
| `docs/` | Cahier des charges enrichi v2, diagrammes UML PlantUML et guide d'optimisation GPU CUDA. |

---

## 3. Démarrage Rapide

### Option A : Déploiement Complet avec Docker Compose (Recommandé)

Le fichier `docker-compose.yml` démarre automatiquement l'ensemble des 6 microservices :

```bash
# Lancement de tous les conteneurs en tâche de fond
docker compose up -d

# Vérification de l'état des conteneurs
docker compose ps
```

Services accessibles immédiatement :
- **Tableau de bord de supervision (Frontend)** : [http://localhost](http://localhost) (ou `http://localhost:4200`)
- **API REST & Administration Django (Backend)** : [http://localhost:8000/admin/](http://localhost:8000/admin/)
- **Gestionnaire de base de données (phpMyAdmin)** : [http://localhost:8080](http://localhost:8080) (Identifiant: `root`, Mot de passe: `vision`)

---

### Option B : Exécution Manuelle en Mode Standalone

#### 1. Installation des dépendances
```bash
pip install -e ".[dev]"
```

#### 2. Diagnostic et validation de la caméra IP
```bash
python -m vision.cli probe cam-entrance
```

#### 3. Enrôlement de la galerie de visages
Placez 2 à 5 photos par personne dans `data/photos/<nom_ou_id>/` :
```bash
python -m vision.cli enroll --photos data/photos
```

#### 4. Test hors-ligne (sans serveur backend)
```bash
python -m vision.cli run cam-entrance --dry-run
python -m vision.cli run cam-gate --dry-run
```

#### 5. Évaluation et métriques de précision
```bash
# Mesure de la reconnaissance faciale (taux FAR/FRR)
python -m vision.cli eval-faces --photos data/photos

# Mesure de la lecture des plaques tunisiennes
python -m vision.cli eval-plates --photos data/plates
```

---

## 4. Contrat d'Événements API (`POST /api/events/`)

Le service IA communique avec le backend via des requêtes HTTP signées par un jeton machine (`Authorization: Token <token>`) :

```json
{
  "kind": "attendance",
  "camera_id": "cam-entrance",
  "subject": "user_42",
  "confidence": 0.94,
  "at": "2026-08-30T08:15:00+01:00",
  "snapshot": "<base64_jpeg_crop>"
}
```

Types d'événements supportés :
- `attendance` : Pointage collaborateur (sujet = ID utilisateur). La première détection note l'arrivée (`check_in`), les suivantes déplacent le départ (`check_out`).
- `access` : Passage véhiculaire (sujet = numéro de plaque normalisé). Si la plaque est inconnue ou interdite, une alerte est levée.
- `unknown_face` : Visage détecté avec confiance mais non répertorié dans la galerie.
- `spoof_attempt` : Tentative de fraude détectée par le module anti-usurpation (photo ou écran présenté à la caméra).

---

## 5. Modèles d'Intelligence Artificielle Utilisés

| Modèle | Fichier | Origine / Architecture | Rôle |
|---|---|---|---|
| **Détection Faciale & Embeddings** | `buffalo_l` | InsightFace (ArcFace ResNet-50) | Extraction des descripteurs 512-d des visages |
| **Vivacité (Anti-Spoofing)** | `models/antispoof.onnx` | MiniFASNet-V2 (2.7_80x80) | Détection passive d'attaques par présentation |
| **Détection de Plaques** | `models/plate_yolo.pt` | YOLOv11 nano (Ultralytics) | Localisation précise du rectangle de la plaque |
| **Lecture OCR Tunisien** | `models/tn_ocr.onnx` | Modèle CCT-XS entraîné spécifiquement | Transcription optique à 13 classes (`0123456789TN_`) |

---

## 6. Formats d'Immatriculation Tunisienne Pris en Charge

| Format d'Immatriculation | Exemple Réel | Normalisation Stockée | Statut de Traitement |
|---|---|---|---|
| **Civil & Particulier** | `159 تونس 8950` | `159TN8950` | Analysé et validé sur Whitelist |
| **Véhicule de Location** | `159 تونس 8950` (bleu) | `159TN8950` | Analysé et validé sur Whitelist |
| **Régime Suspensif** | `RS 130486` | `RS130486` | Analysé et validé sur Whitelist |
| **Véhicule Étatique** | `20-130486` | `20130486` | Nettoyé et validé sur Whitelist |
| **Corps Diplomatique** | `46 CD 02` | `46CD02` | Nettoyé et validé sur Whitelist |
| **Militaire & Essai** | `21551`, `73141 ت ن` | Chiffres seuls | Nettoyé et consigné |

---

## 7. Conformité Légale & Sécurité Biométrique

- **Conformité INPDP (Loi tunisienne 2004-63)** : Séparation stricte des identités et des représentations vectorielles 512-d.
- **Purge Automatisée des Clichés** : Commande de maintenance `python manage.py purge_snapshots --days 30` supprimant physiquement les photos de contrôle archivées.

---

## 8. Suite de Tests & Qualité

```bash
# Tests unitaires du service Vision IA (40 tests)
pytest

# Tests unitaires du backend Django (33 tests)
docker compose exec backend python manage.py test
```

---

## 9. Collection Postman Incluse

Le fichier [`postman_collection.json`](postman_collection.json) à la racine permet de tester et visualiser immédiatement les réponses de l'ensemble des endpoints REST directement dans **Postman** (Auth JWT, Profil & validation d'e-mail, Sécurité du mot de passe, Ingestion IA, Seuil d'horaire dynamique, Présences, Véhicules, Alertes et Rapports Excel/PDF).

---

## 10. Guides Utilisateurs (Documentation & PDF)

- **Version Française** : [GUIDE_UTILISATEUR.md](GUIDE_UTILISATEUR.md) / [**GUIDE_UTILISATEUR.pdf**](GUIDE_UTILISATEUR.pdf)
- **النسخة العربية** : [GUIDE_UTILISATEUR_AR.md](GUIDE_UTILISATEUR_AR.md) / [**GUIDE_UTILISATEUR_AR.pdf**](GUIDE_UTILISATEUR_AR.pdf)

