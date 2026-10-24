# London Air

La qualité de l'air à Londres, par le [London Air Quality Network](https://www.londonair.org.uk)
(LAQN), géré par l'Environmental Research Group de l'Imperial College London :
l'indice britannique DAQI (Daily Air Quality Index) de chaque arrondissement
(borough) et de chaque site de mesure, heure par heure, avec l'indice de
chaque polluant.

Non affilié à London Air ni à l'Imperial College London. Les données viennent
de son API ouverte (`api.erg.ic.ac.uk`), utilisées telles que London Air les
publie.

## Ce que fait l'intégration

- Lit le bulletin horaire de London Air, sans compte ni clé : une requête toutes
  les 30 ou 60 minutes couvre tous les arrondissements et sites.
- Crée **un appareil par arrondissement** (le pire indice de ses sites) et **un
  appareil par site de mesure** choisi, 10 en tout au plus : le DAQI (1 à 10),
  sa bande en toutes lettres, l'indice de chaque polluant mesuré (PM2.5, PM10,
  NO₂, O₃, SO₂) et l'âge du bulletin.
- Ajoute un widget de tableau de bord **Qualité de l'air à Londres**, deux
  déclencheurs de scène (**pollution de l'air en hausse**, **redevenue
  faible**) et une action de scène **Lire la qualité de l'air**.
- Trouve un arrondissement ou un site par son nom ou son code, ou les plus
  proches de votre maison.

Lecture seule : l'intégration ne fait que lire des données publiques.

## Prérequis

- Gladys Assistant 5.2.0 ou plus récent.
- Un accès Internet de Gladys vers `api.erg.ic.ac.uk`.
- Pour chercher autour de votre maison : sa position, dans **Paramètres →
  Maisons**.

## Configuration

### Choisir les arrondissements et les sites

1. Ouvrez l'onglet **Configuration** de l'intégration.
2. Cliquez sur **Trouver une zone** : saisissez un arrondissement, un lieu ou
   un code de site (`Camden`, `Marylebone`, `MY1`), ou laissez vide pour
   lister les arrondissements et sites les plus proches de votre maison, avec
   leur distance.
3. Saisissez les arrondissements voulus dans **Arrondissements**, par nom ou
   numéro, séparés par des virgules (`Camden, Westminster`), et les sites dans
   **Sites**, par code (`CD1, MY1`). Enregistrez.
4. Dans l'onglet **Découverte**, ajoutez-les à Gladys.

Un arrondissement résume son secteur ; un site, près de chez vous ou d'une
école, dit ce qu'on y respire (un site de bord de route sur un grand axe
mesure bien plus haut qu'un site de fond). La [carte de London
Air](https://www.londonair.org.uk/) montre tous les sites.

### Autres réglages

- **Relevé** : toutes les 30 minutes (par défaut) ou toutes les heures. London
  Air publie un bulletin par heure : lire plus souvent n'apporterait rien.
- **Langue** : langue des noms de fonctionnalités (fixés à l'ajout d'un
  appareil : choisissez-la d'abord) et des textes de scène. Français par
  défaut.

Le bouton **Vérifier les zones** lit le bulletin tout de suite et dit ce que
donne chaque arrondissement et site, et quels noms ou codes ne sont pas
compris.

## Appareils

Un appareil par arrondissement (`London Air <arrondissement>`) ou par site
(`London Air <nom du site>`).

| Fonctionnalité                    | Valeurs                                 |
| --------------------------------- | --------------------------------------- |
| Indice de qualité de l'air (DAQI) | 1 à 10, le pire polluant                |
| Pollution de l'air                | la bande en toutes lettres, en français |
| Indice PM2.5, PM10, NO₂, O₃, SO₂  | 1 à 10, chaque polluant                 |
| Âge du bulletin                   | minutes depuis l'heure du bulletin      |

Seuls les polluants mesurés par le site (ou par un site de l'arrondissement)
sont créés. Le bulletin horaire donne **des indices, pas des
concentrations** : chaque polluant est son indice, sur la même échelle de 1 à 10.

L'**indice quotidien de qualité de l'air** britannique a quatre bandes :
**Faible** (Low, 1 à 3), **Modéré** (Moderate, 4 à 6), **Élevé** (High, 7 à 9)
et **Très élevé** (Very High, 10). Le pire polluant fixe l'indice. Un
arrondissement prend, polluant par polluant, le pire de ses sites.

Un polluant « No data » ne publie rien. Un bulletin de plus de 3 heures n'est
plus publié comme actuel : Gladys garde les dernières valeurs avec leur date,
et le widget dit que les données sont périmées.

## Widget

**Qualité de l'air à Londres** :

- avec un arrondissement ou un site choisi : jusqu'à quatre tuiles de
  polluants, la bande colorée (vert Faible, orange Modéré, rouge Élevé et Très
  élevé) et l'âge du bulletin ;
- sans : une ligne par arrondissement ou site, sa bande colorée.

## Scènes

### Déclencheur : London Air : pollution de l'air en hausse

Se déclenche quand la bande d'un arrondissement ou d'un site passe à
**Modéré** ou pire, ou s'aggrave encore (Modéré puis Élevé déclenche deux
fois). Un changement à l'intérieur d'une bande (4 puis 5) ne déclenche rien.
Filtres : l'arrondissement ou le site, et la **nouvelle bande** : cochez les
bandes à partir de votre seuil (par exemple Élevé et Très élevé). Informations
pour les actions : nom, bande, indice, indice précédent, le polluant qui fixe
l'indice, un résumé tout fait.

### Déclencheur : London Air : pollution de l'air redevenue faible

Se déclenche quand la bande revient à **Faible** après un épisode modéré ou
pire. Filtres : l'arrondissement ou le site, et la pire bande de l'épisode
(cochez les mêmes bandes que ci-dessus pour apparier les deux scènes).
Informations : la nouvelle bande et l'indice, la pire bande et le pire indice
de l'épisode, un résumé.

Le premier indice lu après l'installation fixe la bande de départ sans rien
déclencher ; un redémarrage ne déclenche pas deux fois le même changement.

### Action : London Air : lire la qualité de l'air

La qualité de l'air d'un arrondissement ou d'un site, ou du pire de ceux
ajoutés : résumé, bande, indice, polluant, l'indice de chaque polluant et
l'âge du bulletin, pour les actions suivantes (un message, une condition).

## Exemples de scènes

- **Fermer les fenêtres** : déclencheur _pollution de l'air en hausse_ avec
  les bandes Élevé et Très élevé → envoyer `{{triggerEvent.data.summary}}` et
  couper la ventilation.
- **On peut aérer** : déclencheur _redevenue faible_ avec les mêmes bandes →
  envoyer « Vous pouvez rouvrir les fenêtres ».
- **Trajet de l'école** : à 7 h 45, action _lire la qualité de l'air_ sur le
  site près de l'école, puis envoyer son résumé.
- **Purificateur** : quand l'indice PM2.5 de votre arrondissement atteint 4,
  allumer le purificateur d'air.

## Dépannage

- **« Aucun arrondissement ni site »** sur l'écran de configuration : saisissez
  au moins un arrondissement ou un site, ou vérifiez l'orthographe avec
  **Vérifier les zones**.
- **« absent du bulletin de London Air »** : certains arrondissements n'ont
  aucun site dans le bulletin horaire (Barnet, Bromley, la City of London… au
  moment où ces lignes sont écrites), et un site peut être hors service.
  **Trouver une zone** liste ceux qui publient, avec leur nombre de sites.
- **« Pas des arrondissements de London Air »** : le nom n'est pas dans la
  liste ; saisissez-le comme **Trouver une zone** l'affiche, ou son numéro.
- **Indices de polluants sans valeur** : le bulletin dit souvent « No data »
  pour une partie des polluants d'un site (dernière heure pas encore reçue,
  analyseur hors service) ; l'indice vient alors des autres.
- **« L'API de London Air ne répond pas »** : les valeurs sont gardées et
  relues au relevé suivant. L'onglet Journaux signale l'erreur une fois, et
  son retour.
- Détails dans l'onglet **Journaux** de l'intégration (`LOG_LEVEL=debug` pour
  plus).

## Limites

- Bulletin horaire : des indices, pas des concentrations, et souvent « No
  data » pour une partie des polluants.
- Ce sont des mesures, pas des prévisions.
- London Air ne publie pas de limite de requêtes : l'intégration fait une
  requête toutes les 30 ou 60 minutes, quel que soit le nombre de zones, et
  seulement tant que l'une d'elles est ajoutée à Gladys.
- Les déclencheurs suivent les bandes telles que publiées : une bande qui
  hésite entre deux valeurs déclenche à chaque changement.
