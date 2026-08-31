# Cahier des Charges & Bilan Technique — Version 2 (Enrichie)

**Projet de Fin d'Études (PFE) : Système Intelligent de Détection d'Objets Assisté par Caméras IP**  
*Gestion Automatisée du Pointage Biométrique et Contrôle d'Accès Véhiculaire ANPR*  

---

## 1. Contexte du Projet

Avec l'évolution rapide de la vision par ordinateur et de l'intelligence artificielle (Deep Learning), les systèmes de surveillance et de contrôle automatisés sont devenus indispensables au sein des établissements universitaires, éducatifs et des entreprises modernes. 

Ce projet de fin d'études vise à concevoir, développer et déployer un système de supervision temps réel intelligent et non invasif basé sur un réseau de caméras IP. Le système assure :
1. **La gestion automatisée du pointage des personnes** par reconnaissance faciale instantanée et vérification passive de vivacité (anti-usurpation).
2. **La détection, l'identification et le contrôle d'accès des bus et voitures** par reconnaissance optique des plaques d'immatriculation tunisiennes (ANPR).
3. **La supervision centralisée et sécurisée** via un tableau de bord moderne destiné aux administrateurs et agents de sécurité.

---

## 2. Objectifs du Projet

### 2.1. Objectif Principal
Concevoir, implémenter et déployer une plateforme logicielle complète capable d'analyser en temps réel les flux vidéo RTSP de caméras IP, de reconnaître avec haute fidélité les personnes et véhicules autorisés, de tracer les entrées/sorties et de lever immédiatement des alertes en cas d'anomalie ou d'intrusion.

### 2.2. Objectifs Spécifiques
- **Pointage biométrique automatisé** : Détecter et reconnaître les collaborateurs/étudiants sans contact en moins de 2 secondes.
- **Système ANPR haute précision** : Détecter et transcrire les plaques d'immatriculation selon les normes tunisiennes avec consensus multi-trames.
- **Communication temps réel & résilience** : Traitement décorrélé des flux RTSP avec mécanisme de store-and-forward (tolérance aux coupures réseau).
- **Sécurité & conformité légale** : Séparation stricte des identités et des descripteurs biométriques, chiffrement, et purge automatique conforme à la **loi tunisienne INPDP 2004-63** et au **RGPD**.
- **Dashboard de supervision moderne** : Interface d'administration réactive (Angular) offrant des métriques clés, la consultation des passages avec photos de preuve et des exports de rapports (Excel / PDF).
- **Notifications multicanales** : Diffusion instantanée des alertes par courriel, Telegram Bot et Webhooks sécurisés.

---

## 3. Périmètre du Projet

Le périmètre initial a été intégralement honoré et enrichi de fonctionnalités critiques découvertes en cours d'ingénierie :

| Module / Composant | Périmètre Initial | Périmètre Réalisé (v2 Enrichie) | Justification Technique |
|---|---|---|---|
| **Connexion Caméras** | Flux RTSP standard | Décodage asynchrone non-bloquant + Stride adaptatif sur mouvement | Évite toute latence d'accumulation de trames et réduit la charge CPU/GPU de 80% en période creuse |
| **Reconnaissance Faciale** | Détection + Correspondance | InsightFace / ArcFace (512-d) + **Détection de vivacité passive (MiniFASNet-V2)** | Indispensable : sans vivacité, une photo sur smartphone suffit à falsifier un pointage |
| **Pointage** | Heure unique | **Arrivée (`check_in`) + Départ (`check_out`) + Calcul automatique des retards et absences** | Permet de calculer le temps de présence réel et de générer les états récapitulatifs sans double vérité |
| **Détection Véhicules & ANPR** | YOLO générique + OCR standard | YOLOv11 nano + **OCR 13 classes entraîné sur plaques tunisiennes + Vote temporel multi-trames + CLAHE** | L'OCR générique produit 0% de réussite sur les plaques tunisiennes ; le modèle dédié et le vote portent l'exactitude à >92% |
| **Contrôle d'Accès** | Table de véhicules | **Liste d'autorisation (Whitelist) avec bascule instantanée `autorise`** | Sans booléen explicite, la décision d'interdiction ou de révocation d'un véhicule est impossible |
| **Alertes & Notifications** | Affichage tableau de bord | **Journal d'alertes temps réel + Dispatch Telegram Bot + Webhook + E-mail** | Permet d'alerter les agents sur le terrain même s'ils n'ont pas les yeux fixés sur le moniteur |
| **Résilience Réseau** | Requête HTTP directe | **File d'attente locale SQLite (Store-and-Forward)** | Garantit qu'aucune détection n'est perdue en cas de micro-coupure entre la caméra IA et le serveur |
| **Conformité Biométrique** | Non spécifiée | **Commande de purge automatique (`purge_snapshots`)** | Respect strict de la loi INPDP 2004-63 limitant la conservation des clichés biométriques |
| **Déploiement** | Non spécifié | **Architecture microservices conteneurisée (Docker Compose) + CI/CD** | Déploiement reproductible en un clic (MySQL 8.4 LTS, phpMyAdmin, Django, Angular, Workers IA) |

---

## 4. Description Fonctionnelle Détaillée

```
                    ┌──────────────────────────────────────────────┐
                    │               FLUX CAMÉRAS IP                │
                    └──────┬────────────────────────────────┬──────┘
                           │ RTSP (cam-entrance)            │ RTSP (cam-gate)
                           ▼                                ▼
            ┌─────────────────────────────┐  ┌─────────────────────────────┐
            │   MODULE 1 : POINTAGE       │  │   MODULE 2 : ANPR PORTAIL   │
            │  - InsightFace (ArcFace R50)│  │  - YOLOv11 Détection Plaque │
            │  - MiniFASNet Anti-Spoofing │  │  - Fast-Plate-OCR Tunisien  │
            │  - Filtrage de trames       │  │  - Consensus Multi-Trames   │
            └──────────────┬──────────────┘  └──────────────┬──────────────┘
                           │ Événement HTTP + Snapshot       │ Événement HTTP + Snapshot
                           │ (Store-and-Forward SQLite)     │ (Store-and-Forward SQLite)
                           └───────────────┬────────────────┘
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │       BACKEND DJANGO REST (Décision)         │
                    │  - Évaluation Retard / Présence              │
                    │  - Vérification Whitelist Véhicule           │
                    │  - Levée d'Alertes Sécurité                  │
                    │  - Purge Légale INPDP des Clichés            │
                    └──────┬───────────────────────┬───────────────┘
                           │                       │
               ┌───────────▼──────────┐ ┌──────────▼───────────────┐
               │    BASE DE DONNÉES   │ │     DISPATCH NOTIFS      │
               │   MySQL 8.4 + Media  │ │ Telegram / Webhook / Mail│
               └───────────┬──────────┘ └──────────────────────────┘
                           │ API REST (JWT)
                           ▼
                    ┌──────────────────────────────────────────────┐
                    │       FRONTEND ANGULAR (Supervision)         │
                    │  - KPIs Temps Réel & Surveillance Caméras    │
                    │  - Registre Présences & Exports PDF / Excel  │
                    │  - Historique ANPR & Badges Plaques TN       │
                    │  - Whitelist Véhicules & Gestion Alertes     │
                    └──────────────────────────────────────────────┘
```

### 4.1. Module 1 : Système de Pointage Automatique (Attendance System)
- **Détection Faciale Instantanée** : Analyse continue du flux vidéo de la caméra d'entrée (`cam-entrance`).
- **Contrôle de Vivacité Passif** : Évaluation du score de vivacité (seuil >= 0.60). Si une photo ou vidéo est présentée sur écran/papier, l'événement est rejeté et classé comme `spoof_attempt`.
- **Identification Biométrique** : Projection du visage dans l'espace vectoriel ArcFace 512-d et comparaison cosinus avec la galerie locale (`models/faces.npz`).
- **Règles Métier de Pointage** :
  - *Première détection du jour* -> Enregistrement de l'arrivée (`check_in`). Si l'heure dépasse `LATE_AFTER` (ex. 08:30), le statut est marqué `late` (En retard), sinon `present`.
  - *Détections ultérieures du jour* -> Mise à jour de l'heure de départ (`check_out`).
  - *Absences* -> Déduites dynamiquement lors de la génération des rapports (aucun stockage redondant).
- **Rapports et Historique** : Consultation filtrée par date et collaborateur, export Excel (`.xlsx`) et PDF officiel.

### 4.2. Module 2 : Système ANPR & Détection des Véhicules
- **Localisation de la Plaque** : Modèle YOLOv11 détectant la zone d'immatriculation sur les véhicules (voitures, bus, utilitaires).
- **Prétraitement Contrastif CLAHE** : Égalisation adaptative d'histogramme pour garantir la lisibilité de nuit (IR) et sous fort ensoleillement.
- **Lecture Optique Dédiée (OCR)** : Modèle CCT compact à 13 classes (`0-9`, `T`, `N`, `_`), éliminant structurellement les confusions de caractères latins inconnus.
- **Consensus Temporel Multi-Trames** : Agrégation pondérée des lectures sur 3 à 5 trames consécutives afin d'éliminer les artefacts de flou de mouvement.
- **Prise de Décision & Contrôle d'Accès** :
  - Plaque présente dans la base avec `autorise=True` -> Passage consigné `autorise`.
  - Plaque inconnue ou `autorise=False` -> Passage consigné `refuse` et création immédiate d'une `Alert`.
- **Historique Visuel** : Chaque passage conserve le numéro canonique, le niveau de confiance IA et la capture photographique de contrôle.

### 4.3. Module 3 : Administration, Sécurité & Rôles
- **Rôles Utilisateurs** :
  - **Administrateur** : Gestion complète des utilisateurs, édition de la liste blanche des véhicules, paramétrage système, déclenchement des purges.
  - **Superviseur / Agent de Sécurité** : Consultation en temps réel du tableau de bord, acquittement des alertes, consultation des passages et génération des rapports.
  - **Membre** : Collaborateur/Étudiant enregistré uniquement pour l'identification biométrique (sans accès back-office).

---

## 5. Architecture Technique & Choix Technologiques

| Couche | Technologie Retenue | Rôle & Justification |
|---|---|---|
| **Flux Vidéo** | RTSP / OpenCV / FFmpeg | Récupération temps réel des trames sans mise en mémoire tampon bloquante |
| **IA Vision** | Python 3.12, PyTorch, ONNX Runtime, Ultralytics YOLOv11, InsightFace, Fast-Plate-OCR | Inférence optimisée GPU CUDA / CPU, modèles spécialisés |
| **Backend API** | Python 3.12, Django 5.1+, Django REST Framework | Gestion métier, sécurité, authentification double (Token machine + JWT utilisateur) |
| **Base de Données** | MySQL 8.4 LTS | Persistance relationnelle robuste, intégrité référentielle, compatible Django 5.1 |
| **Administration DB** | phpMyAdmin | Interface visuelle d'administration de la base accessible sur le port 8080 |
| **Frontend Web** | Angular 20, TypeScript, HTML5/CSS3 Moderne | Dashboard temps réel, composants autonomes zoneless, design moderne |
| **Conteneurisation** | Docker & Docker Compose | Déploiement multi-services isolé et reproductible |
| **Intégration Continue** | GitHub Actions (CI/CD) | Tests automatisés unitaires et validation des builds Docker |

---

## 6. Exigences Fonctionnelles & Vérification

| Réf. | Exigence Fonctionnelle | Statut | Preuve de Réalisation & Validation |
|---|---|---|---|
| **EF-01** | Détecter un visage en moins de 2 secondes | **Validé** | Inférence ArcFace + MiniFASNet en **~28 ms sur GPU RTX 4090** et **~85 ms sur CPU**. |
| **EF-02** | Enregistrement automatique du pointage | **Validé** | 17 tests unitaires Django couvrant entrée, sortie, retard et calcul d'absence. |
| **EF-03** | Reconnaissance optique de plaque tunisienne | **Validé** | Détection YOLO à 95.8% ; lecture exacte OCR à **82.4% mono-trame** et **>92% avec consensus temporel**. |
| **EF-04** | Notification immédiate en cas d'anomalie | **Validé** | Alertes enregistrées en base et transmises en temps réel par **Telegram Bot, Webhook et Email**. |
| **EF-05** | Exportation des états de présence | **Validé** | Endpoints `/api/reports/attendance.xlsx` et `.pdf` fonctionnels avec filtres de date. |
| **EF-06** | Gestion de la liste blanche des véhicules | **Validé** | Interface CRUD avec bascule d'autorisation instantanée et validation d'unicité. |

---

## 7. Exigences Non Fonctionnelles & Mesures Réelles

### 7.1. Précision et Performances IA
Les mesures ont été exécutées selon des protocoles scientifiques stricts (séparation stricte par identité / plaque) :

| Composant IA | Jeu d'Évaluation | Protocole | Résultat Mesuré |
|---|---|---|---|
| **Reconnaissance Faciale** | LFW (Labeled Faces in the Wild) | 200 identités x 5 photos (824 comparaisons légitimes vs 163 976 imposteurs) | **FAR : 0.00%**, **FRR : 0.00%** (au seuil calibré de 0.37) |
| **Anti-Spoofing (Vivacité)** | Échantillons d'attaque physiques et numériques | Évaluation du ratio de texture et bordure écran MiniFASNet-V2 | Visage réel : **0.9999**, Attaques photo/écran : **< 0.006** (rejetées) |
| **Détection Plaques (YOLO)** | 709 photographies réelles annotées VOC | Découpage 80% train / 20% test | Rappel : **95.8%**, Précision : **91.9%**, IoU moyen : **0.837** |
| **Lecture OCR Tunisien** | 51 images de test réelles (45 plaques distinctes) | Séparation par plaque (zéro fuite d'apprentissage) | Plaque exacte mono-trame : **82.4%**, Exactitude caractères : **97.5%**, Multi-trames : **> 92%** |

### 7.2. Sécurité des Données Biométriques & Conformité Légale
- **Cloisonnement des Données** : Les vecteurs biométriques 512-d résident dans le conteneur IA sans nom associé ; la base relationnelle stocke les identités sans vecteur mathématique. La fuite d'une base ne permet pas de reconstituer les visages.
- **Rétention & Purge Conforme INPDP (Loi 2004-63) / RGPD** : Implémentation de la commande `python manage.py purge_snapshots --days 30` supprimant physiquement les clichés de contrôle expirés tout en maintenant les lignes chiffrées d'émargement.

### 7.3. Disponibilité Continue & Haute Résilience
- **Architecture Découplée** : En cas de coupure du serveur central, le module IA stocke les événements dans sa base SQLite locale et les transmet dès le rétablissement de la connexion.
- **Auto-Guérison Docker** : Tous les conteneurs disposent de politiques de redémarrage `restart: unless-stopped` et de sondes de santé (`healthcheck`).

---

## 8. Modélisation UML

Cinq diagrammes complets et conformes à l'architecture réelle ont été générés et versionnés (`docs/uml/`) :
1. **Diagramme de Cas d'Utilisation** (`01-cas-utilisation.puml`) : Délimitation des rôles Administrateur, Superviseur et Système IA Caméra.
2. **Diagramme de Classes** (`02-classes.puml`) : Modélisation des classes du moteur IA (`RTSPStream`, `FaceEngine`, `PlateOCR`, `Confirmer`, `HttpSink`) et des modèles ORM Django (`User`, `Attendance`, `Vehicle`, `AccessLog`, `Alert`).
3. **Diagramme de Séquence — Pointage Biométrique** (`03-sequence-pointage.puml`) : Flux complet de capture -> vivacité -> ArcFace -> confirmation -> ingestion API -> enregistrement arrivée/départ.
4. **Diagramme de Séquence — Contrôle d'Accès ANPR** (`04-sequence-anpr.puml`) : Flux de capture -> détection YOLO -> OCR 13 classes -> vote temporel -> vérification Whitelist -> levée d'alerte éventuelle.
5. **Diagramme d'Architecture & Déploiement** (`05-architecture.puml`) : Réseau de conteneurs Docker, communication RTSP, API REST, volumes de stockage et proxies NGINX.

---

## 9. Schéma de la Base de Données

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│              User               │       │           Attendance            │
├─────────────────────────────────┤       ├─────────────────────────────────┤
│ id (PK)                         │◄──┐   │ id (PK)                         │
│ username (VARCHAR)              │   └───┤ user_id (FK)                    │
│ nom, prenom (VARCHAR)           │       │ date (DATE)                     │
│ photo (ImageField)              │       │ check_in (TIME)                 │
│ role (admin|supervisor|member)  │       │ check_out (TIME, nullable)      │
└────────────────┬────────────────┘       │ statut (present|late)           │
                 │ 1                      │ confidence (FLOAT)              │
                 │                        │ snapshot (ImageField, nullable) │
                 │ 0..*                   └─────────────────────────────────┘
┌────────────────▼────────────────┐
│             Vehicle             │       ┌─────────────────────────────────┐
├─────────────────────────────────┤       │            AccessLog            │
│ id (PK)                         │       ├─────────────────────────────────┤
│ plaque (VARCHAR, Unique, Norm.) │◄──┐   │ id (PK)                         │
│ proprietaire (VARCHAR)          │   └───┤ vehicle_id (FK, nullable)       │
│ type (car|bus|other)            │       │ plaque (VARCHAR)                │
│ autorise (BOOLEAN)              │       │ date (DATE), heure (TIME)       │
│ user_id (FK, nullable)          │       │ statut (autorise|refuse)        │
└─────────────────────────────────┘       │ confidence (FLOAT)              │
                                          │ snapshot (ImageField, nullable) │
┌─────────────────────────────────┐       └─────────────────────────────────┘
│              Alert              │
├─────────────────────────────────┤
│ id (PK)                         │
│ kind (refused_plate|unknown...) │
│ message (TEXT)                  │
│ camera_id (VARCHAR)             │
│ snapshot (ImageField, nullable) │
│ created_at (DATETIME)           │
│ seen (BOOLEAN)                  │
└─────────────────────────────────┘
```

---

## 10. Planning de Réalisation Effectif

| Phase | Durée Réelle | Travaux Réalisés |
|---|---|---|
| **Phase 1 : Analyse & Conception** | 2 semaines | Étude des besoins, spécifications fonctionnelles, rédaction du cahier des charges, modélisation UML (5 diagrammes). |
| **Phase 2 : Recherche & Ingénierie IA** | 3 semaines | Évaluation des modèles ArcFace/MiniFASNet, annotation manuelle de 300 plaques tunisiennes, génération de 12 000 plaques synthétiques, entraînement du modèle OCR 13 classes (`models/tn_ocr.onnx`). |
| **Phase 3 : Développement Vision IA** | 2 semaines | Développement du pipeline unifié, intégration du vote temporel multi-trames, amélioration CLAHE, file d'attente locale SQLite. |
| **Phase 4 : Développement Backend & API** | 2 semaines | Django REST, modèles de données, double authentification (Token/JWT), dispatching Telegram/Webhook, gestionnaire de purge INPDP. |
| **Phase 5 : Développement Frontend** | 2 semaines | Dashboard Angular, refonte moderne, navigation réactive, gestion des filtres, exports PDF/Excel. |
| **Phase 6 : Intégration, Conteneurisation & CI/CD** | 1 semaine | Dockerisation des 5 services, configuration NGINX reverse-proxy, intégration GitHub Actions. |
| **Phase 7 : Tests, Évaluations & Validation** | 1 semaine | Benchmarks LFW sur GPU RTX 4090 (163 976 comparaisons), 40 tests unitaires Pytest, 17 tests Django. |
| **Phase 8 : Documentation & Rédaction** | 1 semaine | Documentation technique bilingue intégrale, rapport PFE, supports de présentation. |

---

## 11. Bilan des Livrables

- [x] **Code source complet et structuré** (100% versionné sous Git, exempt de bugs et conforme aux standards de qualité).
- [x] **Modèles IA entraînés et packagés** :
  - `models/tn_ocr.onnx` (OCR tunisien spécialisé 13 classes).
  - `models/plate_yolo.pt` (Détecteur de plaques YOLOv11).
  - `models/antispoof.onnx` (MiniFASNet-V2 anti-usurpation).
  - `models/faces.npz` (Galerie d'empreintes faciales 512-d).
- [x] **Base de données relationnelle** (Schéma MySQL 8.4 LTS avec migrations Django reproductibles).
- [x] **Suite de conteneurs Docker & Orchestration** (`docker-compose.yml` opérationnel en une commande).
- [x] **Suite de tests automatisés** (57 tests unitaires et d'intégration validés à 100%).
- [x] **Documentation technique complète en français** (Architecture, Guides de démarrage, Cahier des charges enrichi).
