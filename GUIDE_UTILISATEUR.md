# Guide d'Utilisation – Plateforme VISION AI
> **Système Intelligent de Pointage Facial & Contrôle d'Accès Véhiculaire**  
> *Guide pratique destiné aux administrateurs, superviseurs, agents de sécurité et responsables des ressources humaines (RH).*

---

## Table des Matières
1. [Introduction & Connexion](#1-introduction--connexion)
2. [Barre de Navigation, Rôles & Thème](#2-barre-de-navigation-rôles--thème)
3. [Tableau de Bord (Supervision en direct)](#3-tableau-de-bord-supervision-en-direct)
4. [Gestion des Collaborateurs & Enrôlement Biométrique (100% Web)](#4-gestion-des-collaborateurs--enrôlement-biométrique-100-web)
5. [Registre des Présences & Preuves d'Audit](#5-registre-des-présences--preuves-daudit)
6. [Contrôle d'Accès Véhicules (ANPR & Lissage Multi-Images)](#6-contrôle-daccès-véhicules-anpr--lissage-multi-images)
7. [Gestion des Véhicules & Liste Blanche](#7-gestion-des-véhicules--liste-blanche)
8. [Gestion des Alertes de Sécurité & Anti-Sabotage](#8-gestion-des-alertes-de-sécurité--anti-sabotage)
9. [Conformité RGPD / INPDP & Traçabilité Cryptographique SHA-256](#9-conformité-rgpd--inpdp--traçabilité-cryptographique-sha-256)
10. [Exportation des Rapports (Excel & PDF)](#10-exportation-des-rapports-excel--pdf)
11. [Foire Aux Questions (FAQ) & Bonnes Pratiques](#11-foire-aux-questions-faq--bonnes-pratiques)

---

## 1. Introduction & Connexion

### Accéder à l'application
Ouvrez votre navigateur web (Google Chrome, Microsoft Edge, Mozilla Firefox ou Safari) et saisissez l'adresse :
- **http://localhost** (ou l'adresse IP de votre serveur d'entreprise).

### Rôles et Droits d'Accès
- **Administrateur (`admin`)** : Accès complet (CRUD collaborateurs, gestion véhicules, configuration caméras, purge et audit).
- **Agent Superviseur (`supervisor`)** : Consultation en temps réel, acquittement d'alertes, autorisation rapide des véhicules et export de rapports.

---

## 2. Barre de Navigation, Rôles & Thème

La barre de navigation compacte supérieure offre un accès direct à tous les modules :

* **Tableau de bord** : Vue synthétique, caméras en direct et indicateurs clés de la journée.
* **Présences** : Registre horodaté des pointages des collaborateurs.
* **Collaborateurs** : Gestion du personnel et enrôlement multi-photos pour la reconnaissance faciale.
* **Entrées / sorties** : Historique et photos de chaque lecture de plaque au portail.
* **Véhicules** : Gestion des véhicules autorisés (liste blanche) et attribution aux employés/visiteurs.
* **Alertes** : Traitement des anomalies de sécurité, tentatives d'usurpation et ruptures de signal.
* **Indicateur Caméras** : Pastille animée verte confirmant la bonne réception des flux vidéo RTSP.
* **Bouton Thème** : Bascule instantanée entre Mode Clair et Mode Sombre.

---

## 3. Tableau de Bord (Supervision en direct)

Le tableau de bord centralise toutes les informations en temps réel grâce au streaming d'événements SSE :

### Cartes d'Indicateurs Clés (KPI)
* **Membres Présents (Vert)** : Nombre de salariés ayant pointé aujourd'hui.
* **Arrivées en retard (Orange)** : Collaborateurs arrivés après l'horaire de référence.
* **Absents estimés (Rouge)** : Employés inscrits n'ayant pas encore pointé.
* **Véhicules Autorisés (Bleu)** : Passages réussis au portail automatique.
* **Accès Refusés (Rouge)** : Plaques inconnues ou interdites au portail.
* **Alertes Non Lues (Violet)** : Anomalies requérant une attention immédiate.

### Visualisation & Configuration des Caméras
Dans la section **Caméras de Surveillance** :
* **Nombre de caméras configurable** : Ajoutez autant de caméras IP (RTSP), webcams USB ou fichiers vidéo que nécessaire.
* **Ajout d'une caméra** *(Administrateurs)* : Cliquez sur le bouton **+ Ajouter une caméra** pour renseigner l'ID unique, le nom, l'URL RTSP (ex: `rtsp://admin:pass@192.168.1.50:554/stream`), l'emplacement et la tâche IA assignée :
  - **Pointage Facial (`attendance`)** : Détection et reconnaissance des collaborateurs.
  - **Portail & Véhicules (`anpr`)** : Lecture automatique des plaques LAPI et commande de barrière.
* **Gestion en direct** : Modifiez les paramètres ou désactivez/supprimez une caméra à tout moment avec la boîte de dialogue de confirmation intégrée.
* **Supervision du flux** : Cliquez sur une caméra active pour ouvrir le lecteur vidéo haute fluidité affichant la résolution, la cadence (FPS) et la santé du flux en direct.
* **Compteur Dynamique dans la Navbar** : La pastille supérieure indique automatiquement en temps réel le nombre de caméras actives connectées.


---

## 4. Gestion des Collaborateurs & Enrôlement Biométrique (100% Web)

Accessible depuis l'onglet **Collaborateurs (`/members`)** :

### Inscription d'un Nouveau Collaborateur
1. Cliquez sur **+ Enrôler un collaborateur**.
2. Saisissez le prénom, nom, matricule / identifiant et rôle.
3. **Importation Multi-Photos** :
   - Glissez-déposez ou sélectionnez plusieurs photos de face (différentes expressions, luminosité, angles légers).
   - Les miniatures s'affichent avec prévisualisation et bouton de suppression individuelle.
4. Cliquez sur **Enregistrer** :
   - Le système stocke les photos haute résolution, extrait les descripteurs faciaux ArcFace et **synchronise instantanément la galerie faciale en arrière-plan sans redémarrage**.

---

## 5. Registre des Présences & Preuves d'Audit

* **Arrivée (Check-in)** : Dès le premier passage du matin devant la caméra d'entrée, l'employé est reconnu, sa photo est capturée et son arrivée enregistrée.
* **Départ (Check-out)** : Lors des passages suivants, l'heure de départ est automatiquement actualisée.
* **Journal d'Audit & Preuves Photographiques** : Cliquez sur le badge `N capture(s)` pour consulter la frise chronologique détaillée de tous les passages de la journée.
* **Fiche Collaborateur (Panneau Latéral)** : Cliquez sur un employé pour afficher ses statistiques de ponctualité et sa timeline complète de mouvements.

---

## 6. Contrôle d'Accès Véhicules (ANPR & Lissage Multi-Images)

Le module ANPR lit automatiquement les plaques d'immatriculation tunisiennes (format civil standard `123 TN 4567`, `RS`, `CD`, `MD`) :

### Lissage Temporel & Cooldown Portail
* **Consensus Multi-Frames** : Lorsqu'un véhicule s'approche de la barrière, le moteur IA analyse la séquence d'images, élimine le flou de mouvement et calcule un consensus pondéré à haute confiance.
* **Déclenchement Unique de la Barrière** : Le système émet **exactement un événement d'accès fiable** par passage avec un cooldown anti-rebond, évitant les doublons dans les journaux.

### Régularisation en 1 Clic (`✓ Autoriser`)
* Si une plaque est refusée dans le journal d'accès, cliquez simplement sur le bouton vert **✓ Autoriser** : le véhicule est instantanément validé dans la liste blanche sans quitter la page.

---

## 7. Gestion des Véhicules & Liste Blanche

Accessible depuis l'onglet **Véhicules (`/vehicles`)** :

* **Recherche et Filtres Réactifs** : Filtrez par plaque, statut d'autorisation ou type (voiture, bus, camion).
* **Saisie Libre & Autocomplete Intelligent (Combobox)** :
  - Tapez les premières lettres du nom d'un collaborateur pour le sélectionner parmi la liste suggérée.
  - Ou tapez librement le nom d'un visiteur externe ou d'une entreprise partenaire.

---

## 8. Gestion des Alertes de Sécurité & Anti-Sabotage

Le système surveille en continu l'intégrité de vos installations :
1. **Tentative d'Usurpation (Anti-Spoofing)** : Détection d'une photo imprimée, écran de smartphone ou tablette présenté devant la caméra de pointage.
2. **Visage Inconnu** : Détection d'un individu non identifié dans une zone sécurisée.
3. **Plaque Refusée** : Véhicule non autorisé au portail.
4. **Surveillance Vidéo Watchdog & Sabotage (Anti-Tampering)** :
   - Détection d'obstruction (lentille masquée, noir complet).
   - Détection d'éblouissement volontaire (laser, torche haute intensité).
   - Détection de rupture ou déconnexion du câble réseau RTSP avec reconnexion automatique.

---

## 9. Conformité RGPD / INPDP & Traçabilité Cryptographique SHA-256

La plateforme intègre des garanties conformes aux normes de protection des données personnelles :

* **Empreintes Cryptographiques SHA-256** : Chaque enregistrement de présence et de passage au portail génère un hash cryptographique immuable garantissant l'intégrité du journal face à toute tentative de falsification.
* **Purge Automatique Configurable** : Les photos et instantanés anciens sont purgés selon la politique de rétention légale configurée (30, 60 ou 90 jours) tout en conservant les métriques chiffrées d'audit.

---

## 10. Exportation des Rapports (Excel & PDF)

Depuis la page **Présences** :
* **Export Excel (`.xlsx`)** : Génère un tableur structuré prêt pour l'intégration RH et logiciels de paie.
* **Rapport PDF Officiel** : Document imprimable avec en-tête d'entreprise, totaux d'heures et synthèse des retards.

---

## 11. Paramètres Utilisateur, Sécurité & Configuration Entreprise

Accessible directement en cliquant sur votre **Pastille Utilisateur / Avatar** dans la barre supérieure de navigation :

### 1. Mon Profil
* Modifiez votre **Nom d'utilisateur**, **Adresse e-mail**, **Prénom** et **Nom**.
* **Validation & Détection de Doublons** : Le système vérifie en temps réel la validité syntaxique de l'adresse e-mail et interdit l'utilisation d'une adresse e-mail ou d'un nom d'utilisateur déjà attribué à un autre compte.

### 2. Sécurité & Mot de Passe
* Mise à jour de votre mot de passe avec :
  - Vérification obligatoire de l'**ancien mot de passe**.
  - Longueur minimale de **6 caractères**.
  - Obligation de choisir un mot de passe différent du mot de passe actuel.
  - Confirmation identique pour éviter toute faute de frappe.

### 3. Paramètres Entreprise *(Administrateurs & Superviseurs)*
* **Nom de l'entreprise** : Personnalisation de l'identité de l'établissement.
* **Seuil d'horaire de retard configurable (`late_after`)** : Définissez l'heure limite d'arrivée (ex: `08:30`, `09:00`) via le sélecteur horaire ou les boutons de raccourcis rapides (`08:00`, `08:15`, `08:30`, `08:45`, `09:00`, `09:30`). Tout pointage effectué après cette heure est automatiquement qualifié « En retard » dans le registre et le tableau de bord.

---

## 12. Foire Aux Questions (FAQ) & Bonnes Pratiques

#### Le système fonctionne-t-il si la connexion réseau est coupée temporairement ?
> **Oui**. Le moteur d'intelligence artificielle intègre une file d'attente hors-ligne SQLite (`HttpSink`). Tous les événements détectés pendant la coupure sont sauvegardés localement et resynchronisés dès le rétablissement du réseau.

#### Combien de photos faut-il ajouter par collaborateur ?
> Nous recommandons d'importer entre **2 et 4 photos récentes** (face neutre, léger sourire, luminosité naturelle) pour maximiser la vitesse et la précision de reconnaissance biométrique.

#### Comment s'assurer d'une lecture optimale des plaques la nuit ?
> Le système applique automatiquement un rehaussement adaptatif de contraste (CLAHE) pour corriger les reflets des projecteurs et l'éclairage infrarouge.

