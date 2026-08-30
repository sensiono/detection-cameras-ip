# Diagrammes UML — section 8 du cahier des charges

Générés depuis PlantUML. Les sources `.puml` sont la référence : on modifie le texte,
jamais l'image. Chaque diagramme a été écrit **à partir du code réel** (noms de classes,
seuils, endpoints), pour qu'il ne se mette pas à mentir dès la première modification.

| Fichier | Diagramme | Demandé par le cahier |
|---|---|---|
| `01-cas-utilisation` | Cas d'utilisation | § 8, tiret 1 |
| `02-classes` | Classes (service IA + modèle de données) | § 8, tiret 2 |
| `03-sequence-pointage` | Séquence : détection → reconnaissance → enregistrement | § 8, tiret 3 |
| `04-sequence-anpr` | Séquence : lecture de plaque → décision → notification | complément module 2 |
| `05-architecture` | Architecture / déploiement | § 8, tiret 4 |

PNG et SVG sont fournis. Pour le rapport Word, préférez le **SVG** : il reste net à
l'impression et à n'importe quel zoom.

## Régénérer

```bash
curl -sSLO https://github.com/plantuml/plantuml/releases/download/v1.2025.4/plantuml-1.2025.4.jar
java -jar plantuml-1.2025.4.jar -tsvg -o . docs/uml/*.puml
java -jar plantuml-1.2025.4.jar -tpng -o . docs/uml/*.puml
```

Puis, pour la page de consultation :

```bash
python3 docs/uml/build_planches.py
```

`!pragma layout smetana` évite d'avoir à installer Graphviz ; seuls les diagrammes de
cas d'utilisation, de classes et d'architecture en ont besoin.

## Ce que les diagrammes disent, et qu'il faut pouvoir défendre

**La décision d'autorisation n'est pas dans l'IA.** Le service de reconnaissance
répond « j'ai lu 198TN4521 » ; c'est la base qui répond « autorisé » ou « refusé ».
On le voit dans les trois diagrammes, et c'est ce qui permet de changer une liste
blanche sans toucher au code de vision.

**Un processus par caméra.** Visible sur le diagramme d'architecture. Deux caméras,
deux processus, aucune dépendance : un flux qui tombe n'entraîne pas l'autre.

**La vivacité est vérifiée avant la galerie.** Sur la planche 03, le fragment
`alt [vivacité < 0.60]` sort de la séquence sans jamais interroger `FaceIndex`. Une photo
ne doit pas pouvoir atteindre une identité, même pour être rejetée ensuite.

**Le `Confirmer` remplace un tracker.** Sur le diagramme de séquence, c'est le seul
garde entre une reconnaissance par trame et une ligne en base : trois votes en cinq
secondes, puis cinq minutes de silence. Sans lui, une présence produirait des dizaines
de lignes par personne.

**Aucune photo n'est stockée dans la galerie.** Le fichier `faces.npz` ne contient que
des vecteurs de 512 dimensions, dont on ne peut pas reconstruire un visage. C'est la
réponse concrète à l'exigence « sécurité des données biométriques » (§ 7), à citer avec
la déclaration INPDP (loi 2004-63) que tout traitement biométrique impose en Tunisie.
