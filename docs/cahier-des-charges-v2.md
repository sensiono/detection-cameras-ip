# Cahier des charges — version 2

Projet de fin d'études — **Système intelligent de détection d'objets assisté par caméras IP**

Cette version reprend le cahier initial section par section et y ajoute trois choses :
ce qui a été **réalisé**, ce qui a été **modifié et pourquoi**, et ce qui **manque encore**.
Les écarts sont écrits ici plutôt que passés sous silence : un écart assumé et justifié se
défend devant un jury, un écart découvert pendant la soutenance ne se défend pas.

État au 30 août 2026. Chiffres mesurés, jamais estimés ; la méthode de mesure est donnée
à chaque fois, parce qu'un pourcentage sans son protocole ne veut rien dire.

---

## 1. Contexte du projet

Inchangé.

## 2. Objectifs du projet

Inchangés. Les cinq objectifs spécifiques sont tous adressés ; leur degré d'achèvement
est détaillé en § 12.

## 3. Périmètre du projet

Le périmètre initial est tenu. **Deux éléments s'y ajoutent**, découverts en cours de
réalisation et non prévus au cahier initial :

| Ajout | Pourquoi il n'était pas optionnel |
|---|---|
| **Détection de vivacité** (anti-spoofing) | Sans elle, une photo du visage d'un collègue affichée sur un téléphone suffit à le pointer présent. ArcFace compare des visages, et la photo d'un visage **est** ce visage. Le module 1 sans vivacité n'est pas un système de pointage, c'est un système de pointage contournable en dix secondes. |
| **Journal d'alertes** | Le § 6 exige de « notifier l'admin en cas d'accès non autorisé », mais le § 9 ne prévoit aucune table pour porter ces notifications. Une table `Alert` a été ajoutée. |

## 4. Description fonctionnelle

### Module 1 — Pointage automatique

Toutes les fonctionnalités du cahier sont réalisées. **Trois précisions** issues de la
réalisation :

* **Entrée *et* sortie.** Le § 9 ne prévoit qu'un champ `heure`. Un pointage réel a une
  arrivée et un départ, sans quoi la durée de présence est incalculable et le module ne
  produit pas les rapports demandés au § 4.1. La table porte donc `check_in` et
  `check_out` : la première détection du jour ouvre la présence, chaque détection
  ultérieure déplace la sortie.
* **L'absence est calculée, jamais stockée.** Une personne sans ligne de présence pour
  une date est absente. La stocker imposerait une tâche nocturne et créerait une seconde
  source de vérité qui finit toujours par diverger de la première.
* **Statut `retard`** dérivé d'un seuil horaire configurable (`LATE_AFTER`).

### Module 2 — Détection des véhicules

Toutes les fonctionnalités sont réalisées. **Un manque du cahier initial a dû être
comblé** : le § 4.3 exige « Autorisation / Refus d'accès », mais la table `Vehicles`
du § 9 ne comporte aucun champ permettant de refuser un véhicule. Un booléen `autorise`
a été ajouté ; sans lui, la fonctionnalité d'autorisation est littéralement inexprimable.

**Formats de plaques tunisiennes traités**, décision explicite :

| Format | Exemple | Traité |
|---|---|---|
| Civil / privé (série تونس numéro) | `159 تونس 895` | ✅ |
| Location (blanc sur bleu, même format) | `159 تونس 895` | ✅ |
| Administration (RS, CD, MD) | `RS 130486` | ✅ reconnu, non normalisé en civil |
| Corps diplomatique, militaire, temporaire, revendeur | `46 CD 02` | ❌ hors périmètre |

Le piège justifiant ce choix : `46 CD 02` est *chiffres–lettres–chiffres*, exactement la
structure d'une plaque civile. Élargir le motif pour l'absorber ferait enregistrer une
voiture diplomatique comme la plaque civile `46TN2`, avec la mauvaise autorisation. Un
format non reconnu est rejeté explicitement plutôt que mal interprété.

## 5. Architecture technique

L'architecture du cahier (caméras IP RTSP → Python/OpenCV/YOLO → Django → MySQL →
Angular) est respectée. **Trois précisions structurantes** :

* **Séparation en trois services.** `vision/` reconnaît et ne connaît aucune base ;
  `backend/` décide et stocke ; `frontend/` affiche. Le service de vision ne décide
  jamais si une plaque est autorisée : il rapporte ce qu'il a vu et sa confiance,
  l'autorisation est une question de base de données. C'est ce qui permet de révoquer
  un véhicule sans toucher aux caméras.
* **Deux mécanismes d'authentification, volontairement.** Un jeton machine (DRF Token)
  pour le compte des caméras, qui ne peut qu'écrire des événements ; JWT pour les humains,
  qui ont des rôles. Ce sont deux choses différentes, un seul mécanisme les confondrait.
* **Modèles retenus** : InsightFace/ArcFace (empreintes 512-d) pour les visages,
  YOLOv11 pour la localisation des plaques, un OCR **entraîné spécifiquement pour les
  plaques tunisiennes** (voir § 7), MiniFASNet-V2 pour la vivacité.

## 6. Exigences fonctionnelles

| Exigence | État | Preuve |
|---|---|---|
| Détecter un visage en moins de 2 s | ⚠️ **non mesuré sur matériel** | Mesuré sur fichiers uniquement. Voir § 13, point 1. |
| Enregistrer automatiquement la présence | ✅ | 17 tests backend, dont la transition entrée/sortie et la limite de retard |
| Reconnaître une plaque d'immatriculation | ✅ | 95,8 % de rappel en détection, 82,4 % en lecture exacte |
| Notifier l'admin en cas d'accès non autorisé | ⚠️ **partiel** | Une alerte est créée et affichée au tableau de bord ; aucune notification *sortante* (courriel, SMS, push). Voir § 13, point 4. |

## 7. Exigences non fonctionnelles

### « Haute précision (> 90 %) » — la formulation est trop vague pour être vérifiable

Le cahier demande « > 90 % » sans dire de quoi. Trois mesures distinctes existent, et
elles ne sont pas comparables entre elles :

| Mesure | Protocole | Résultat | > 90 % ? |
|---|---|---|---|
| **Reconnaissance faciale** | 200 identités LFW × 5 photos, moitié enrôlée / moitié testée, 471 comparaisons légitimes contre 92 787 imposteurs | FAR **0,00 %**, FRR **0,00 %** au seuil 0,37 | ✅ |
| **Détection de plaques** | 709 photographies annotées Pascal VOC, 142 en test | rappel **95,8 %**, précision **91,9 %** | ✅ |
| **Lecture de plaques (OCR)** | 51 images de test, 45 plaques, séparées **par plaque** du jeu d'entraînement | **82,4 %** de plaques exactes, **97,5 %** de caractères | ❌ sur la plaque entière, ✅ par caractère |

**Sur la lecture, l'écart doit être expliqué, pas caché.** « Plaque exacte » exige que
*tous* les caractères soient justes : à 97,5 % par caractère, une plaque de sept
caractères a environ 0,975⁷ ≈ 84 % de chances d'être entièrement juste. C'est
mécanique, et c'est pourquoi ce chiffre est toujours très inférieur à toute mesure
par élément.

Il faut aussi savoir que **les deux modèles tunisiens publiés** (Roboflow Universe,
`yassine-mhirsi/…-Detection`) sont des modèles de **détection seule** : ils s'arrêtent
là où s'arrête la ligne « détection » ci-dessus, et n'essaient pas de lire les
caractères. Leur « > 90 % » et le 82,4 % ne mesurent pas la même chose.

### Sécurité des données biométriques

* **Les empreintes et les identités ne vivent pas au même endroit.** Le service de vision
  détient des vecteurs 512-d sans nom ; le backend détient des noms sans vecteur. Aucune
  moitié ne permet à elle seule de reconstituer un visage.
* **Déclaration INPDP (loi 2004-63)** obligatoire pour tout traitement biométrique en
  Tunisie. **Non effectuée** — voir § 13, point 5.
* Manque encore : politique de rétention et de purge des instantanés.

### Disponibilité continue

**Non traitée.** Aucun redémarrage automatique, aucune supervision de processus, aucune
reprise après coupure du flux RTSP au-delà de la reconnexion applicative. Voir § 13.

## 8. Modélisation UML

✅ Réalisée, et **enrichie** : le cahier demande quatre diagrammes, cinq sont livrés
(le diagramme de séquence est décliné en deux — pointage et ANPR — parce que les deux
chaînes ne partagent ni leurs acteurs ni leurs décisions). Sources PlantUML versionnées
et régénérables dans `docs/uml/`.

## 9. Base de données

Les quatre tables du cahier sont réalisées. **Les écarts, tous justifiés :**

| Table | Écart | Raison |
|---|---|---|
| `Users` | fusionnée pour les trois rôles | Le cahier décrit une seule population ; deux tables d'identité imposeraient une jointure à chaque événement |
| `Attendance` | `heure` → `check_in` + `check_out`, + `confidence`, `snapshot` | Sans sortie, pas de durée de présence ni de rapport exploitable ; l'instantané rend la ligne vérifiable |
| `Vehicles` | **+ `autorise`** | Sans ce champ, le § 4.3 (« Autorisation / Refus ») est inexprimable |
| `Logs` → `AccessLog` | + `confidence`, `snapshot`, lien vers `Vehicle` | Un refus sans preuve visuelle est incontestable dans le mauvais sens |
| **`Alert`** *(nouvelle)* | — | Le § 6 exige la notification, le § 9 ne prévoyait rien pour la porter |

Les plaques sont **stockées normalisées** : `159 TN 0895`, `159-tn-895` et `159TN895`
sont une seule ligne. Sans cela, la table d'autorisation contient des doublons qui
laissent passer un véhicule révoqué sous une autre orthographe.

## 10. Planning prévisionnel

Le planning initial reste la référence. Une phase manquait : **la constitution et
l'étiquetage des jeux de données**. Elle a coûté l'essentiel du temps de la partie IA —
300 plaques transcrites à la main — et n'apparaissait dans aucune phase. À inscrire dans
le rapport comme enseignement de conduite de projet : *un projet d'IA sans données
annotées n'a pas commencé.*

## 11. Livrables

| Livrable | État |
|---|---|
| Code source complet | ✅ dépôt privé, 115 fichiers |
| **Modèle IA entraîné** | ✅ `models/tn_ocr.onnx`, entraîné pour les plaques tunisiennes, + `models/antispoof.onnx` |
| Base de données | ✅ MySQL 8, migrations Django |
| Documentation technique | ✅ un README par service, guide GPU, README d'entraînement, ce document |
| Rapport PFE | ⬜ à rédiger |
| Présentation PowerPoint | ⬜ à produire |

---

## 12. Ce qui a été réalisé au-delà du cahier

1. **Détection de vivacité** — MiniFASNet-V2, converti depuis les poids d'origine avec
   provenance vérifiable (sha256). Mesuré sur les échantillons étiquetés du dépôt amont :
   visage réel 0,9999 accepté, deux attaques rejetées à 0,006 et 0,001.
2. **OCR entraîné pour le tunisien.** Le modèle OCR générique lit les plaques tunisiennes
   à **0,0 %** : il n'a jamais vu le mot تونس et écrit `P`, `J` ou `C` à sa place. Sur 900
   découpes, il n'a jamais produit la forme canonique. D'où l'entraînement d'un modèle
   dédié, à alphabet restreint à 13 classes, qui **ne peut pas** écrire ces lettres.
3. **Jeu de données étiqueté à la main** — 300 plaques tunisiennes, séparées **par plaque**
   et non par image (35 des 300 photos montrent une voiture qui réapparaît ailleurs ;
   séparer par image mettrait la même plaque des deux côtés et mesurerait la mémorisation).
4. **Protocole d'évaluation** — `eval-plates`, `eval-faces`, `eval-detection` livrés comme
   commandes, pour que les chiffres du rapport soient reproductibles par le jury.
5. **Journal d'alertes et instantanés** attachés à chaque décision.

## 13. Écarts et manques restants

Par ordre de risque pour la soutenance.

1. **Le système n'a jamais tourné sur une vraie caméra RTSP.** Tout est validé sur
   fichiers. L'exigence « moins de 2 secondes » du § 6 n'est donc pas mesurée sur
   matériel, et une caméra apporte ce qu'un fichier n'apporte pas : corruption H.264,
   reconnexions, flou de mouvement à vitesse de portail, infrarouge nocturne.
   **C'est le point le plus exposé du projet.**
2. **Aucune galerie de visages réelle.** Le seuil 0,37 est calibré sur LFW, qui est
   frontal, bien éclairé et pré-recadré. Il faut ~10 personnes × 5 photos prises sur la
   caméra du site, puis relancer `eval-faces`. Tant que ce n'est pas fait, la
   reconnaissance faciale — objectif *principal* du cahier — n'a aucun chiffre issu du
   terrain, alors que l'ANPR, objectif secondaire, en a une page entière.
3. **600 découpes de plaques restent à étiqueter** sur 900. C'est le levier le moins cher
   sur le 82,4 %.
4. **Notification sortante absente.** Le § 6 demande de notifier l'administrateur ; le
   système crée une alerte visible au tableau de bord, mais n'envoie rien. Un
   administrateur qui ne regarde pas l'écran n'est pas notifié.
5. **Déclaration INPDP non déposée** (loi 2004-63 sur la protection des données à
   caractère personnel). Obligation légale pour un traitement biométrique, indépendante
   du code.
6. **Disponibilité continue non traitée** (§ 7) : ni supervision de processus, ni
   redémarrage automatique, ni politique de sauvegarde.
7. **Rétention des données biométriques** : aucune politique de purge des instantanés et
   des empreintes.
8. **Montée en charge non évaluée** : le système est conçu pour deux caméras ; le
   comportement au-delà n'est pas mesuré.

## 14. Réserves de mesure à conserver dans le rapport

Ces réserves protègent le travail : les énoncer soi-même vaut mieux que se les faire
opposer.

* **Le 0 % d'erreur en reconnaissance faciale ne dit pas que le système est parfait.**
  LFW est quasi saturé pour ArcFace (état de l'art 99,8 %). Ce chiffre valide le
  **seuil**, pas le déploiement.
* **51 images de test, c'est ±2 % par image.** Un écart de trois points entre deux
  entraînements est du bruit. Le point de contrôle est choisi sur la **validation**, et
  le score publié est celui du **test** — choisir le point de contrôle sur le test
  gonflerait le chiffre et n'en ferait plus une mesure.
* **Le modèle OCR est spécialisé.** Sur des cadrages atypiques il se trompe là où le
  modèle générique tombait juste. Il faut le réévaluer sur les images du portail visé.
* **La vivacité se dégrade sur cadrage serré** : sur LFW (pré-recadré 250×250, sans
  contexte) 10 % des vrais visages sont rejetés. La caméra doit voir plus qu'un visage.
