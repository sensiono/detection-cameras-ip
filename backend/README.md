# Backend — Django REST Framework & MySQL

Le service backend centralise la base de données, la logique décisionnelle métier, l'authentification et les interfaces d'administration. Le service de vision IA se limite à rapporter ce qu'il observe ; c'est le backend qui décide si un véhicule est autorisé, si une présence est en retard, et qui lève les alertes.

---

## 1. Installation & Démarrage

### Via Docker Compose (Recommandé)
Le backend est automatiquement lancé avec sa base MySQL 8.4 via le `docker-compose.yml` à la racine :
```bash
docker compose up -d backend
```

### Installation Locale (Développement)
```bash
# 1. Création de l'environnement virtuel
python -m venv .venv
source .venv/bin/activate  # Sur Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 2. Configuration des variables d'environnement
cp .env.example .env

# 3. Lancement des migrations et création du compte administrateur
python manage.py migrate
python manage.py createsuperuser

# 4. Lancement du serveur de développement
python manage.py runserver 0.0.0.0:8000
```

---

## 2. Génération du Jeton Machine pour les Caméras IA

Pour permettre au service IA de poster ses détections sur l'API sans passer par un compte utilisateur humain :

```bash
python manage.py shell -c "
from core.models import User
from rest_framework.authtoken.models import Token
u, _ = User.objects.get_or_create(username='ai-service')
print('Jeton Caméra :', Token.objects.get_or_create(user=u)[0].key)
"
```

Ce jeton doit être reporté dans `config.yaml` à la section `sink.token`.

---

## 3. Points d'Accès API REST

| Méthode | Point d'Accès (Route) | Authentification Requise | Description & Usage |
|---|---|---|---|
| **POST** | `/api/events/` | Token Machine (`ai-service`) | Ingestion unique des flux d'événements caméras |
| **POST** | `/api/auth/login/` | Publique | Authentification JWT (jetons d'accès et de rafraîchissement) |
| **GET** | `/api/dashboard/` | Superviseur / Admin | Métriques et compteurs de la journée en un seul appel |
| **GET** | `/api/attendance/` | Superviseur / Admin | Registre des présences avec filtres (`?user=&from=&to=`) |
| **GET** | `/api/logs/` | Superviseur / Admin | Historique des passages de véhicules (`?statut=&from=&to=`) |
| **CRUD** | `/api/vehicles/` | Admin (Écriture) / Superviseur (Lecture) | Gestion de la liste blanche des véhicules (`autorise`) |
| **GET** | `/api/users/` | Admin / Superviseur | Liste des collaborateurs et membres du personnel |
| **GET / POST** | `/api/alerts/`, `.../{id}/seen/` | Superviseur / Admin | Consultation et acquittement des alertes de sécurité |
| **GET** | `/api/reports/attendance.xlsx` | Superviseur / Admin | Export officiel des présences au format Excel |
| **GET** | `/api/reports/attendance.pdf` | Superviseur / Admin | Export officiel des présences au format PDF |

---

## 4. Modèle de Données Relationnel

```
User (admin | supervisor | member)
  ▲
  ├── Attendance (un enregistrement par personne et par jour)
  │     - check_in, check_out, statut (present|late), confidence, snapshot
  │
  └── Vehicle (plaque normalisée unique)
        - autorise (booléen), type, proprietaire
        ▲
        └── AccessLog (historique de passage)
              - plaque, statut (autorise|refuse), heure, confidence, snapshot

Alert (enregistrements autonomes de sécurité)
  - kind (refused_plate | unknown_face | spoof_attempt), message, camera_id, snapshot, seen
```

### Règles Métier Clés
1. **Les absences sont calculées dynamiquement** : Une personne sans émargement pour une date ouvrée est considérée absente. Aucun enregistrement d'absence statique n'est créé en base afin d'éviter les désynchronisations.
2. **Normalisation automatique des plaques** : Toutes les plaques sont stockées au format canonique (ex: `159TN8950`). Les espaces et tirets sont éliminés avant la vérification d'unicité.
3. **Double authentification découplée** : Jeton DRF statique pour le service machine IA (autorisé uniquement en écriture sur `/api/events/`) et JWT pour les utilisateurs humains du tableau de bord.

---

## 5. Notifications en Temps Réel

Le fichier `core/notify.py` gère le dispatching instantané des alertes lorsqu'une plaque non autorisée, un visage inconnu ou une usurpation est détectée :
- **Telegram Bot** : Notification envoyée via l'API Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`).
- **HTTP Webhook** : Envoi d'un payload JSON à tout système tiers externe (`ALERT_WEBHOOK_URL`).
- **Courrier Électronique** : Notification SMTP classique (`ALERT_EMAIL`).

---

## 6. Purge Conforme INPDP (Loi 2004-63 & RGPD)

Pour respecter les réglementations sur la protection des données biométriques et personnelles, une commande de gestion permet de purger automatiquement les clichés photographiques de contrôle après expiration de la période de rétention :

```bash
# Simulation sans suppression réelle
python manage.py purge_snapshots --days 30 --dry-run

# Exécution réelle de la purge
python manage.py purge_snapshots --days 30
```

Cette commande supprime physiquement les fichiers images du disque et met à null les champs `snapshot` des tables `Attendance` et `AccessLog`, tout en préservant l'intégrité des statistiques et heures d'émargement.

---

## 7. Exécution des Tests Unitaires

```bash
python manage.py test
```
*17 tests unitaires couvrant l'ensemble des règles métier, transitions d'état et sécurités d'accès.*
