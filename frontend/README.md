# Frontend — Tableau de Bord de Supervision Angular

Interface utilisateur moderne et réactive destinée aux agents de supervision et administrateurs de sécurité. L'application communique exclusivement avec l'API Django via REST et JWT, sans dépendance directe avec les flux caméras bruts.

---

## 1. Démarrage & Déploiement

### Via Docker Compose (Recommandé)
Le frontend est servi par un conteneur NGINX optimisé :
```bash
docker compose up -d frontend
```
Accessible sur : [http://localhost](http://localhost) (port 80 ou port 4200).

### Développement Local (Node.js)
```bash
# Nécessite Node.js >= 20
npm install
npm start             # Démarre le serveur de dev sur http://localhost:4200
npm run build         # Compilation pour la production
```

Le fichier `proxy.conf.json` redirige automatiquement les requêtes `/api` et `/media` vers `http://127.0.0.1:8000`, éliminant tout blocage CORS en phase de développement.

---

## 2. Pages & Fonctionnalités du Tableau de Bord

| Route Angular | Titre de la Page | Description & Fonctionnalités |
|---|---|---|
| `/login` | Authentification | Connexion sécurisée JWT avec identifiant et mot de passe. |
| `/` | Tableau de Bord | 6 cartes de métriques clés temps réel (Présents, Retards, Absents, Véhicules autorisés/refusés, Alertes), statut des 2 caméras actives, flux des 5 dernières alertes. |
| `/attendance` | Registre des Présences | Tableau d'émargement biométrique, filtres par période et par collaborateur, badges de statut (`Présent` / `En retard`), zoom sur capture de preuve, boutons d'export **Excel (.xlsx)** et **PDF**. |
| `/logs` | Contrôle d'Accès ANPR | Historique des passages de véhicules, visualisation des plaques d'immatriculation au format tunisien, jauge de confiance IA et capture du véhicule. |
| `/vehicles` | Véhicules Autorisés | Gestion de la liste blanche (Whitelist), formulaire d'ajout/modification avec sélecteur de catégorie et bascule instantanée d'autorisation. |
| `/alerts` | Alertes de Sécurité | Grille des anomalies de sécurité (plaques refusées, visages inconnus, tentatives de spoofing) avec capture associée et bouton d'acquittement immédiat. |

---

## 3. Architecture & Structure du Projet

```
src/app/
├── app.config.ts       # Fournisseurs Angular (HttpClient avec intercepteur JWT, routing zoneless)
├── app.routes.ts       # Définition des routes en lazy loading (chargement à la demande)
├── app.ts              # Barre de navigation supérieure, statut des caméras et profil utilisateur
├── core/
│   ├── api.ts          # Service client HTTP typé centralisant tous les appels vers l'API Django
│   ├── auth.ts         # Gestionnaire de session basé sur les Signals Angular, intercepteur HTTP et gardien de route (AuthGuard)
│   └── models.ts       # Interfaces TypeScript synchronisées avec les schémas Django REST
└── pages/              # Composants autonomes (Standalone Components) pour chaque vue
    ├── alerts.ts
    ├── attendance.ts
    ├── dashboard.ts
    ├── login.ts
    ├── logs.ts
    └── vehicles.ts
```

---

## 4. Choix de Conception & Expérience Utilisateur (UI/UX)

- **Thème Sombre & Glassmorphism** : Palette soignée Obsidian & Slate (`#0b0f17`), surfaces translucides avec flou d'arrière-plan (`backdrop-filter: blur(16px)`), bordures subtiles et accents colorés éclatants.
- **Micro-Interactions Réactives** : Effet de survol avec zoom fluide sur les captures photographiques de pointage et de plaques.
- **Badges d'Immatriculation Réalistes** : Composant CSS `.tn-plate` reproduisant fidèlement l'aspect des plaques d'immatriculation tunisiennes (fond noir, écriture blanche en police monospace).
- **Zoneless & Composants Autonomes** : Utilisation exclusive des Signals Angular et de l'architecture sans Zone.js pour des performances maximales et un bundle ultra-léger (< 80 Ko compressé).
