# Contribuer au développement de ProjetDuMois.fr

## Dépendances

- NodeJS >= 18
- Outils Bash : curl, awk, grep, sed, bc
- PostgreSQL >= 13
- Python 3 (et le module `requests`)
- [Osmium](https://osmcode.org/osmium-tool/) > 1.10
- [osmctools](https://wiki.openstreetmap.org/wiki/Osmupdate)
- [Imposm](https://imposm.org/) >= 3
- [pg_tileserv](https://github.com/CrunchyData/pg_tileserv)
- Dépendances de [sendfile_osm_oauth_protector](https://github.com/geofabrik/sendfile_osm_oauth_protector#requirements)

### Compilation osmium

ProjetDuMois a besoin d'une version récente de osmium puisqu'il tire parti des nouvelles fonctions tags-filter.
Peu de distributions linux ont les dernières versions disponibles et vous aurez surement besoin de compiler osmium vous-même.

Voir les consignes sur le [README officiel](https://github.com/osmcode/osmium-tool/blob/master/README.md#building).

Les paquets suivants pourront être utiles pour cela

- build-essential
- cmake
- zlib1g-dev
- libbz2-dev
- liblz4-dev
- libboost-dev
- libboost-program-options-dev

## Débuter

```bash
git clone https://github.com/vdct/ProjetDuMois.git
cd ProjetDuMois
git submodule update --init
```

## Configuration générale

La configuration générale de l'outil est à renseigner dans `config.json`. Un modèle est proposé dans le fichier `config.example.json`. Les paramètres sont les suivants :

- `OSM_USER` : nom d'utilisateur OpenStreetMap pour la récupération de l'historique des modifications avec métadonnées
- `OSM_PASS` : mot de passe associé au compte utilisateur OSM
- `OSM_CLIENT_ID` : client ID généré depuis le compte OpenStreetMap
- `OSH_PBF_URL` : URL du fichier OSH.PBF (historique et métadonnées, exemple `https://osm-internal.download.geofabrik.de/europe/france/reunion-internal.osh.pbf`)
- `OSM_PBF_URL`: URL du fichier OSM.PBF (etat courant de la base, exemple `https://download.geofabrik.de/europe/france-latest.osm.pbf`)
- `POLY_URL`: URL d'un fichier de polygone dans lequel les projets existent (exemple `https://download.geofabrik.de/europe/france.poly`)
- `DB_USE_IMPOSM_UPDATE` : Active ou désactive l'intégration d'imposm3 (permet d'utiliser une base existante et tenue à jour par d'autres moyens, par défaut `true`)
- `WORK_DIR` : dossier de téléchargement et stockage temporaire (doit pouvoir contenir le fichier OSH PBF, exemple `/tmp/pdm`)
- `OSM_URL` : instance OpenStreetMap à utiliser (exemple `https://www.openstreetmap.org`)
- `OSM_API_URL` : instance API OpenStreetMap à utiliser (exemple `https://api.openstreetmap.org`)
- `JOSM_REMOTE_URL` : adresse du serveur JOSM à contacter (exemple `http://localhost:8111`)
- `OSMOSE_URL` : instance Osmose à utiliser (exemple `https://osmose.openstreetmap.fr`)
- `NOMINATIM_URL` : instance de Nominatim à utiliser (exemple `https://nominatim.openstreetmap.org`)
- `MAPILLARY_URL` : instance Mapillary à utiliser (exemple `https://www.mapillary.com`)
- `MAPILLARY_API_KEY`: clé d'API Mapillary ([peut être créée ici](https://www.mapillary.com/dashboard/developers))
- `MATOMO_HOST`: URL vers l'hôte Matomo auquel nous souhaitons envoyer les statistiques terminant par un /. Supprimez pour désactiver. (exemple `https://stats.maison.fr/`)
- `MATOMO_SITE`: Identifiant du site web Matomo auquel se rapportent les statistiques (exemple `6`)
- `REPOSITORY_URL` : URL du dépôt du logiciel (exemple `https://github.com/vdct/ProjetDuMois`)
- `VECT_STYLE` : URL d'un [style compatible avec Maplibre GL](https://maplibre.org/maplibre-gl-js/docs/) (exemple `https://tile-vect.openstreetmap.fr/styles/liberty/style.json`)
- `PDM_TILES_URL` : URL d'accès au service _pg_tileserv_, qui met à disposition les couches dans votre base de données
- `GEOJSON_BOUNDS` : objet de type `Geometry` (polygone ou multipolygone) en GeoJSON délimitant la zone où rechercher des notes OSM
- `MAINTENANCE_MODE`: option pour afficher une page spéciale sur le site indiquant qu'il est en cours de maintenance (valeur `true` pour activer)

### Connexion à Postgresql

Pour se connecter à Postgresql, une variable d'environement `DB_URL` est attendue avec une chaine conninfo pour disposer des informations nécessaires.
Ceci est valable quelle que soit la solution retenue, docker ou locale.

```bash
export DB_URL="postgres://user:password@host:5432/database"
```

Reportez-vous au chapitre 33.1.1 du [guide postgresql](https://www.postgresql.org/docs/13/libpq-connect.html).

## Configuration des projets

Chaque projet est défini via un sous-répertoire de `projects`. Chaque sous-répertoire doit contenir les fichiers suivants :

- `info.json` : métadonnées du projet
- `howto.md` : descriptif des tâches à réaliser au format Markdown (utiliser les niveaux de titres >= 3)
- `contribs.sql` : Script SQL contenant des requêtes UPDATE sur la table pdm_changes, attribuant des classes de contribution à certains changements donnant droit à des points
- `extract.sh` : Script optionnel qui produit un fichier csv des données actuelles produites par le projet, proposé au téléchargement dans l'interface.

Les propriétés dans `info.json` sont les suivantes :

- `id` : identifiant de la mission (caractères autorisés : A-Z, 0-9, \_ et -)
- `title` : nom de la mission (assez court)
- `start_date` : date de début de la mission (format AAAA-MM-JJ)
- `end_date` : date de fin de la mission (format AAAA-MM-JJ)
- `summary` : résumé de la mission
- `links` : définition des URL pour les liens vers des pages tierces (wiki OSM)
- `database.osmium_tag_filter` : filtre Osmium sur les tags à appliquer pour ne conserver que les objets OSM pertinents (par exemple `nwr/*:covid19`, [syntaxe décrite ici](https://osmcode.org/osmium-tool/manual.html#filtering-by-tags)). Il est possible d'enchaîner plusieurs filtres par & et en répétant l'indication de primitive à chaque niveau. L'opérateur != n'est pour l'instant pas pris en compte.
- `database.imposm` : configuration pour l'import des données actualisées d'OSM (`types` pour les types de géométrie à prendre en compte, `mapping` pour les attributs, voir [la documentation Imposm](https://imposm.org/docs/imposm3/latest/mapping.html#tags) pour le format de ces champs)
- `database.compare` : configuration pour la recherche d'objets OpenStreetMap à comparer, suit le format de `database.imposm` avec une propriété supplémentaire `radius` (rayon de rapprochement en mètres)
- `datasources` : liste des sources de données qui apparaissent sur la page (voir ci-dessous)
- `statistics` : configuration de l'affichage des statistiques sur la page du projet
- `statistics.count` : activer le comptage des objets du projet
- `statistics.feature_name` : nom à afficher à l'utilisateur pour ces objets
- `statistics.osmose_tasks` : nom des tâches accomplies via Osmose
- `statistics.points` : configuration des points obtenus selon le type de contribution (en lien avec `contribs.sql`)
- `editors` : configuration spécifique à chaque éditeur OSM. Pour ProjetDuMois, les informations sont disponibles ci-dessous. Pour iD, il est possible d'utiliser [les paramètres listés ici](https://github.com/openstreetmap/iD/blob/develop/API.md).

### Temporalité des projets

Chaque projet est muni de sa propre période temporelle d'existence qui influence les traitements à faire pour maintenir le journal des changements à jour.  
Le script `project:update` va automatiquement choisir entre deux sources de données selon 5 configurations différentes :
- Les fichiers OSH contenant l'ensemble de l'historique de tous les objets sur une zone géographique donnée. Ils sont mis à jour chaque mois.
- Les fichiers différentiels journaliers qui contiennent l'ensemble des modifications réalisées chaque jour dans le monde.

ProjetDuMois permet la mise à jour au fil de l'eau et la reconstruction complète de l'historique d'un projet terminé. La seconde possibilité est particulièrement utile en cas de changement de périmètre ou d'amélioration des techniques de comptage.  
Un projet peut ne pas avoir de date de fin, en utilisant `end_date: null` dans sa configuration, pour un suivi sans limite de temps.

![Ligne de temps des projets](./projects_process.svg)
- Cas 1 : un projet suffisament ancien se tenant complètement dans la période temporelle du fichier OSH de sa zone, n'ayant pas besoin de mises à jour mais pouvant être réinitialisé à la demande.
- Cas 2 : un projet ancien sans date de fin, trop rarement mis à jour et nécessitant une réinitialisation pour retrouver un état actuel.
- Cas 3 : un projet ancien sans date de fin, mis à jour au cours des 30 derniers jours et éligible à un complément via les fichiers de diff journaliers jusqu'à la date actuelle.
- Cas 4 : un projet ancien se terminant dans le futur, qui utilisera donc les données OSH puis les diffs journaliers jusqu'à la date courante.
- Cas 5 : un projet commencé récemment et se terminant dans le futur, régulièrement mis à jour et éligible à la mise à jour via les fichiers diffs.
- Cas 6 : un projet non commencé, n'entrainant pour l'instant aucun traitement.

### Dénombrement des objets

Le dénombrement des objets est opéré sur le journal des modifications de chaque objet sélectionné par le filtre du projet. Il est activé via le drapeau `statistics.count` dans la configuration du projet.  
Ces opérations nécessitent non seulement de connaître les dates d'existence de chaque version mais aussi l'adhérence de chacune au filtre du projet.  

Il est possible de résumer les différentes configurations et leurs effets selon le schéma suivant :
![Dénombrements au fil du temps](./projects_counts.svg)
Certains objets ont une vie complexe et peuvent perdre et retrouver une validité dans le projet à plusieurs reprises.

La plateforme établit elle-même les dates des décomptes à chaque fois que le script est executé par rapport à la date de dernière mise à jour des décomptes de chaque projet.  
Ces dates sont sélectionnées selon les hypothèses suivantes :
- Tous les jours à minuit jusqu'à la date de dernière mise à jour des décomptes ou du début du mois en cours
- Chaque premier de chaque mois jusqu'à la date de dernière mise à jour des décomptes ou le début du projet

En exécutant le script de calcul chaque jour, on obtiendra donc 364 valeurs à la fin d'une année complète de traitement.

Les dénombrements suivants sont réalisés de manière systématique :
- Nombre d'objets existants et validant le filtre du projet à une date donnée

### Filtrer les objets

ProjetDuMois s'appuie sur Osmium et Imposm pour filtrer les objets concernés par les projets configurés, au moyen des clés de configuration `database.osmium_tag_filter` et `database.imposm`.

La documentation de la syntaxe des filtres Osmium est décrite dans [la documentation de l'outil](https://docs.osmcode.org/osmium/latest/osmium-tags-filter.html). Néanmoins, en raison de la nécessité d'appliquer ces filtres à plusieurs l'endroits dans le processus de sélection, y compris en dehors d'osmium, les filtres mobilisant l'opérateur `!=` ne sont pas supportés.

### Se passer d'imposm3

Il est possible de ne pas utiliser imposm3 et de se connecter à une base de données pourvue des données nécessaires.
Il faudra s'assurer qu'elle est tenue à jour toutes les heures minimum pour les besoins de PdM.

Dans le cas où imposm3 serait désactivé, il faudra produire des vues matérialisées pour chaque projet configurés appelées `pdm_project_${project_id}`, avec la structure suivante :

```sql
osm_id BIGINT,
name VARCHAR(255)
tags json
geom GEOMETRY
```

Optionellement, si le mode compare est activé dans un projet donné, une vue supplémentaire appelée `pdm_project_${project_id}_compare` conforme à ce qui doit être comparé est nécessaire. Elle a la même structure que ci-dessus.

Au-delà de ces tables, il est nécessaire d'avoir une table `pdm_boundary` contenant le découpage administratif de la zone ([niveaux administratifs](https://wiki.openstreetmap.org/wiki/Tag:boundary%3Dadministrative) 4, 6 et 8) et ayant cette structure :

```sql
id INT
osm_id BIGINT
name VARCHAR
admin_level INT
tags HSTORE
geom GEOMETRY(Geometry, 3857)
centre GEOMETRY(Point, 3857)
```

La colonne `centre` est comprise comme étant un point compris dans le périmètre de la limite (vous pouvez utiliser [ST_PointOnSurface](https://postgis.net/docs/ST_PointOnSurface.html)).

Créer des indexes sur les colonnes `osm_id`, `tags`, `geom` et `centre` peut être utile suivant la population d'objets touchée par un projet donné.

PdM va automatiquement créer une table `pdm_boundary_subdivide` en utilisant [ST_Subdivide](https://postgis.net/docs/ST_Subdivide.html) pour faciliter le calcul d'intersection entre les objets du projet et le zonage administratif.

### Sources de tuiles

Plusieurs sources de tuiles sont mobilisables, et sont à faire apparaître dans le champ `datasources` du fichier `info.json`.

#### Osmose

[Osmose](https://wiki.openstreetmap.org/wiki/Osmose) est un outil d'analyse qualité et d'aide à l'intégration de données ouvertes. Les propriétés à renseigner sont les suivantes :

- `source` (obligatoire `osmose`): type de source
- `item` : numéro d'item (code à quatre chiffres)
- `class` (optionnel) : numéro de classe (code à plusieurs chiffres)
- `country` (optionnel) : motif de nom de pays Osmose (exemple `france*`)
- `name` : nom à faire apparaître à l'utilisateur
- `subtitles` (optionnel) : objet clé > valeur pour remplacer les sous-titres des signalements Osmose (recherche par motif)
- `buttons` : libellé à faire apparaître sur les boutons d'édition (exemple `{ "done": "C'est fait", "false": "Rien ici" }`)
- `minzoom` (défaut 7): Niveau de zoom minimum au delà duquel la couche est visible
- `maxzoom` (défaut 18): Niveau de zoom maximal au delà duquel la couche n'est plus visible
- `tiles` (défaut) : Liste d'URL TMS

#### Notes OSM

Les [notes OpenStreetMap](https://wiki.openstreetmap.org/wiki/Notes) sont une méthode simple pour envoyer des commentaires textuels par dessus la carte, et faciliter la contribution par des publics novices. Les propriétés à renseigner sont les suivantes :

- `source` (obligatoire `notes`): type de source
- `name` : nom à faire apparaître à l'utilisateur
- `description` : texte descriptif indiquant la méthode de résolution d'une note
- `terms` : liste des termes à rechercher dans les notes (au singulier)
- `buttons` : libellé à faire apparaître sur les boutons d'édition (exemple `{ "close": "C'est fait" }`)
- `data` (défaut) : GeoJson de données de la couche

#### Objets OpenStreetMap

Les objets actuellement présents dans OpenStreetMap peuvent être affichés pour éviter les doublons et permettre leur édition. Les propriétés à renseigner sont les suivantes :

- `source` (obligatoire `osm`): type de source
- `name` : nom à faire apparaître à l'utilisateur
- `description` : texte descriptif de l'objet affiché
- `minzoom` (défaut 7) : Niveau de zoom minimum au delà duquel la couche est visible
- `maxzoom` (défaut 14) : Niveau de zoom maximal au delà duquel la couche n'est plus visible
- `tiles` (défaut) : Liste d'URL TMS
- `layers` (défaut) : Liste des layers correspondant à `tiles` à utiliser

Cette source ne peut apparaître qu'une seule fois, et correspond aux objets recherchés dans les options `database` de `info.json`.

#### Objets OpenStreetMap pour comparaison

Des objets indirectement liés au projet mais pertinents pour la contribution peuvent également apparaître. Les propriétés à renseigner sont les suivantes :

- `source` (obligatoire `osm-compare`) : type de source
- `name` : nom à faire apparaître à l'utilisateur
- `description` : texte descriptif de l'objet affiché
- `minzoom` (défaut 9) : Niveau de zoom minimum au delà duquel la couche est visible
- `maxzoom` (défaut 14) : Niveau de zoom maximal au delà duquel la couche n'est plus visible
- `tiles` (défaut) : Liste d'URL TMS
- `layers` (défaut) : Liste des layers correspondant à `tiles` à utiliser

Cette source ne peut apparaître qu'une seule fois, et correspond aux objets recherchés dans les options `database.compare` de `info.json`.

#### OpenStreetMap extra objects

Ces couches affichent des objets non pris en compte dans le périmètre du projet. Ils sont affichés pour informer les contributeurs que quelque chose de différent existe déjà à cet endroit. Les propriétés à fournir sont les suivantes :

- `source` (obligatoire `osm-extra`) : type de source
- `name` : nom à faire apparaître à l'utilisateur
- `description` : texte descriptif de l'objet affiché
- `minzoom` (défaut 9) : Niveau de zoom minimum au delà duquel la couche est visible
- `maxzoom` (défaut 14) : Niveau de zoom maximal au delà duquel la couche n'est plus visible
- `tiles` (défaut) : Liste d'URL TMS
- `layers` (défaut) : Liste des layers correspondant à `tiles` à utiliser

Ces sources peuvent apparaitre autant de fois que nécessaire

#### Fonds raster

Des couches raster peuvent être ajoutées en fond de carte pour faciliter la contribution ou donner plus de contexte. Les propriétés suivantes doivent être définies :

- `source` (obligatoire `background`): type de source
- `icon` (défaut `other`): le symbole à afficher dans la légende (au choix `aerial`, `thematic`, `picture`, `other`)
- `name` : nom à faire apparaître à l'utilisateur
- `tiles` : Tableau d'URL TMS
- `attribution` : Attribution à faire apparaitre sur la carte
- `minzoom` (défaut 2) : Niveau de zoom minimum au delà duquel la couche est visible
- `maxzoom` (défaut 19) : Niveau de zoom maximal au delà duquel la couche n'est plus visible
- `tileSize` (défaut 256) : Taille d'une arrête de tuile en pixels

Ces sources doivent être déclarées dans l'ordre inverse d'apparition. La couche inférieure doit être donnée en premier.

#### Sources stats

Pour activer l'affichage de statistiques selon le découpage administratif, vous pouvez ajouter la couche ayant la définition suivante :

- `source` (obligatoire `stats`): type de source
- `minzoom` (défaut 2) : Niveau de zoom minimum au delà duquel la couche est visible
- `maxzoom` (défaut 14) : Niveau de zoom maximal au delà duquel la couche n'est plus visible
- `tiles` (défaut) : Tableau d'URL TMS
- `layers` (défaut) : Liste des layers correspondant à `tiles` à utiliser

### Éditeur intégré de Projet du Mois

La configuration des projets permets de personnaliser les champs disponibles dans l'éditeur intégré. La configuration s'exprime en JSON comme l'exemple suivant (ajouté dans l'objet `editors` du fichier `config.json`) :

```json
"pdm": {
  "fields": [
    ... liste de champs...
  ],
  "title": {
    "add": "Libellé de l'action ajouter",
    "edit": "Libellé de l'action éditer"
  }
}
```

Les champs sont définis comme des objets JSON standards, ajouté au tableau `fields` ci-dessus.

Chaque type, à l'exception de `hidden` supporte les champ communs suivants :

- `name`: Libellé du champ tel qu'affiché à l'utilisateur
- `help`: Lien hypertexte pointant vers toute ressource appropriée d'aide pour ce champ
- `description`: Un text plus long que le libellé qui apporte les détails nécessaire à propos de champ
- `optional`: Un champ booléen false/true rendant respectivement le champ obligatoire ou non.

#### Attributs statiques ou externes

Il permet de définir des tags statiques ajoutés à tout objet créé avec l'éditeur. Il est possible dans la liste de tags d'ajouter une valeur `*` pour accepter toute valeur arrivant d'une source externe (par exemple les identifiants `ref:FR:SIRET` renseignés dans Osmose).

```json
{ "type": "hidden", "tags": { "tag_1": "value_1", "tag_2": "value_2", "tag_3_externe": "*" } }
```

#### Champs classiques

Les champs textuels simples sont couverts par 3 types différents : `text`, `number` ou `email`.
Ils produisent tous trois un champ texte standard muni des fonctions de validation appropriées.

```json
  { "type": "text", "name": "Libellé", "tag": "tag_key", "optional": false },
  { "type": "number", "name": "Libellé", "tag": "tag_key", "optional": false },
  { "type": "email", "name": "Libellé", "tag": "tag_key", "optional": false }
```

#### Zone de texte

Une zone de texte plus ample pour saisir des valeurs plus conséquentes.

```json
{ "type": "textarea", "name": "Libellé", "tag": "tag_key", "optional": false }
```

#### Listes de valeurs

Une liste de valeurs avec des entrées personnalisées pointant sur une clé OSM définie.

```json
{
  "type": "select",
  "name": "Libellé",
  "tag": "tag_key",
  "optional": false,
  "values": [
    { "v": "value_1", "l": "Value 1 label" },
    { "v": "value_2", "l": "Value 2 label" }
  ]
}
```

On peut également faire en sorte que une valeur dans la liste renseigne plusieurs attributs OSM, par exemple :

```json
{
  "type": "select",
  "name": "Type",
  "tag": "_select1",
  "values": [
    {
      "l": "Gendarmerie",
      "tags": { "name": "Gendarmerie nationale", "operator": "Gendarmerie nationale", "police:FR": "gendarmerie" }
    },
    {
      "l": "Police nationale",
      "tags": { "name": "Police nationale", "operator": "Police nationale", "police:FR": "police" }
    },
    { "l": "Police municipale", "tags": { "name": "Police municipale", "police:FR": "police_municipale" } }
  ]
}
```

Dans le cas où plusieurs attributs sont renseignés, il est possible de forcer la suppression de certains tags avec un texte vide, par exemple pour gérer le cas où les objets sont dans plusieurs catégories :

```json
{
  "type": "select",
  "name": "Type de commerce",
  "tag": "_select1",
  "values": [
    { "l": "Agence d'assurance", "tags": { "shop": "", "office": "insurance" } },
    { "l": "Agence de voyages", "tags": { "shop": "travel_agency", "office": "" } }
  ]
}
```

#### Champs booléens

Les champs booléens à 2 ou 3 états utilisent les boutons radio pour proposer des options à l'utilisateur vers une clé OSM définie.
`2states` pour oui/inconnu et `3states` pour oui/non/inconnu.

```json
  { "type": "2states", "name": "Libellé", "tag": "tag_key"},
  { "type": "3states", "name": "Libellé", "tag": "tag_key"}
```

#### Opérateurs et enseignes

Pour faciliter la sélection d'une enseigne ou d'un réseau de commerces/équipements, le champ de type `nsi` (pour [Name Suggestion Index](https://nsi.guide/), un recensement collaboratif des marques et enseignes) peut être utilisé. Celui-ci dispose d'options spécifiques :

- `path` : chemin vers la liste à utiliser (elle apparaît en titre du site web, par exemple `brands/shop/coffee`)
- `locationSet` : un code pays sur deux lettres, en minuscules, pour ne lister que les enseignes du pays concerné (optionel)

Exemple d'utilisation :

```json
{ "type": "nsi", "name": "Marque", "path": "brands/shop/bakery", "locationSet": "fr" }
```

### Décomptes et statistiques

Les statistiques projet sont établies par le script `./db/31_projects_update_tmp.sh`. Le script complète la table SQL pdm_feature_counts avec les jours manquant entre le timestamp OSH et le jour courant.

Il est possible de forcer le recomptage de l'intégralité d'un projet en supprimant le fichier de timestamp OSH, récupération des fichiers PBF/PBH et en relançant le script

```bash
rm ${WORK_DIR}/osh_timestamp
./db/11_pbf_update_tmp.sh
./db/31_projects_update_tmp.sh
```

#### Points et contributions

Certaines contribution peuvent donner lieu à l'attribution de points aux contributeurs responsables.
La configuration des projets établit le lien entre des classes de contribution et les points associés. Il faut donc qualifier certains changement avec les bonnes classes.
La plateforme attribue les classes communes suivantes :

- `add`: Les changements concernant des objets version=1
- `edit` : Les changements concernant des objets version>1

Il est possible d'attribuer des classes propres à chaque projet en créant un fichier `contribs.sql` à côté de `info.json`.
Ce script contient des requêtes UPDATE modifiant les entrées nécessaires de la table `pdm_changes`. Chaque changement ne peut avoir qu'une classe et ne correspondre qu'à une valeur de point unique.

Les montant de points attribués sont configurés dans `info.json` :

```json
{
  "statistics": {
    "points": { "add": 3, "project1": 1 }
  }
}
```

## Installation

L'installation peut se faire en utilisant docker ou bien directement sur l'hôte.
Confère à la section Déploiement ci-dessous pour obtenir un ProjetDuMois exploitable.

### Submodules git

ProjetDuMois dépend de quelques sous-modules git. Pensez à executer les commandes suivantes avant le build :

```sh
git submodule init
git submodule update
```

### Construction Docker

Il est possible de construire un serveur node.js unique pourvu des fonctionnalités nécessaires à toute l'exploitation. Il inclus osmium 1.10.0 avec Debian Buster.
L'image Docker n'inclue cependant pas de serveur postgresql et vous pourrez utiliser [l'image de CampToCamp](https://hub.docker.com/r/camptocamp/postgres/tags?page=1&ordering=last_updated).

```bash
docker build [--build-arg IMPOSM3_VERSION=0.11.0] [--build-arg CONFIG=./config.json] -t pdm/server:latest .
```

Avec :

- IMPOSM3_VERSION : Version d'imposm3 à intégrer à l'image Docker
- CONFIG : Chemin vers le fichier de configuration principal à utiliser (Par défaut `./config.json`)

### Installation locale

Assurez-vous d'avoir une version de npm fonctionnelle avant de lancer la commande suivante :

```bash
npm install
```

## Déploiement

### Base de données

La base de données utilise PostgreSQL. Pour créer la base, lancez la commande en tant que super-utilisateur :

```bash
psql -c "CREATE DATABASE pdm"
psql -c "CREATE EXTENSION IF NOT EXISTS postgis"
psql -c "CREATE EXTENSION IF NOT EXISTS hstore"
```

### pg_tileserv

#### Sans Docker

pg_tileserv étant requit pour afficher la données osm sur la carte, vous pouvez soit l'installer soit utiliser une image Docker.
Pour l'installation `wget` et `unzip` sont nécessaires.

```bash
# télécharge la dernière version
wget https://postgisftw.s3.amazonaws.com/pg_tileserv_latest_linux.zip
# décompression / suprresion
unzip pg_tileserv_latest_linux.zip -d /opt/pg_tileserv
rm pg_tileserv_latest_linux.zip
# url de la base de données à laquelle se connecter
export DATABASE_URL=postgres://postgres:password@pdm-db:5432/pdm
# lanchement de pg_tileserver
cd /opt/pg_tileserv
./pg_tileserv
```

#### Avec Docker

Vous pouvez aussi utiliser l'image incluse dans le docker-compose.yml ou, pour une image plus lègere utiliser le [Dockerfile alpine suivant](https://github.com/CrunchyData/pg_tileserv/blob/master/Dockerfile.alpine) afin de build vous même l'image.
Vous pouvez aussi très bien installer pg_tileserv dans pdm via le Dockerfile pour builder l'image Docker pdm en l'incluant. Mais ceci n'est pas recommandé.

### Docker

Le service s'installe avec les deux commandes suivantes :

```bash
docker run --rm [--network=your-network] -e DB_URL=postgres://user:password@host:5432/database pdm/server:latest install
docker run --rm [--network=your-network] -v host_work_dir:container_work_dir -e DB_URL=postgres://user:password@host:5432/database pdm/server:latest init
```
La deuxième commande va initialiser chaque projet dans la base de données et peut donner lieu à des temps de traitement importants selon le périmètre configuré.

Ensuite, lancez le serveur avec la commande :

```bash
docker run -d --rm [--network=your-network] -p 3000:3000 --name=pdm -v host_work_dir:container_work_dir -e DB_URL=postgres://user:password@host:5432/database pdm/server:latest run
```

N'oubliez pas d'ajouter les lignes suivantes dans vos crontab pour mettre à jour les projets périodiquement, idéalement quotidiennement.

```bash
docker run --rm [--network=your-network] -v host_work_dir:container_work_dir -e DB_URL=postgres://user:password@host:5432/database pdm/server:latest update_daily
```

Des commandes dédiées sont néamoins disponibles pour relancer une update particuliere:

```bash
docker run --rm [--network=your-network] -v host_work_dir:container_work_dir -e DB_URL=postgres://user:password@host:5432/database pdm/server:latest update_features
docker run --rm [--network=your-network] -v host_work_dir:container_work_dir -e DB_URL=postgres://user:password@host:5432/database pdm/server:latest update_changes
docker run --rm [--network=your-network] -v host_work_dir:container_work_dir -e DB_URL=postgres://user:password@host:5432/database pdm/server:latest update_projects
```
Voir ci-dessous pour la portée de chacune.

### Instance locale

La base de données s'appuie sur PostgreSQL. Pour installer la base :

```bash
psql -d pdm -f db/00_init.sql
```

Le script suivant est à lancer pour permettre l'import imposm :

```bash
npm run features:update
./db/11_features_update_tmp.sh {init,update}
```

Il comporte deux modes :
* init, télécharge un fichier OSM.pbf et lance un import complet imposm
* update, rafraichit des vues matérielles (probablement à supprimer)


Le script suivant permet de mettre à jour quotidiennement le journal des changes:  

```bash
npm run changes:update
./db/21_changes_update_tmp.sh {init, update}
```

Il comporte deux modes :
* init, initialise le journal des projets passés et en cours sur l'ensemble de la période de leur date de départ à aujourd'hui
* update, met à jour au fil de l'eau l'ensemble des projets depuis leur date de mise à jour respective

Le script suivant est à lancer quotidiennement pour récupérer les statistiques de contribution (notes, objets ajoutés, badges obtenus) :

```bash
npm run projects:update
./db/31_projects_update_tmp.sh
```

## Site web

Le code de l'interface web se trouve dans le dossier `website`. Il s'agit d'un serveur [ExpressJS](http://expressjs.com/), combiné à des modèles [Pug](https://pugjs.org).

Les modèles Pug sont dans le sous-dossier `templates`. Celui-ci est organisé selon la logique suivante :

- Dans `templates`, le modèle général `layout.pug` et son fichier CSS
- Dans `common`, les éléments génériques à toutes les pages (`<head>`, en-tête, pied de page)
- Dans `components`, les composants principaux qui peuplent les pages (carte, bloc statistiques...)
- Dans `pages`, chacune des pages du site (accueil, carte, page projet...)

Le site est visible à l'adresse [localhost:3000](http://localhost:3000).

### Docker

L'image Docker inclue le nécessaire pour servir le site web et executer les tâches de mise à jour automatiques.
Vous pouvez la lancer avec:

```bash
docker run -d --rm [--network=your-network] -p 3000:3000 --name=pdm -v host_work_dir:container_work_dir -e DB_URL=postgres://user:password@host:5432/database pdm/server:latest run
```

### Docker compose

Un fichier docker-compose est fourni ici pour faciliter l'execution de la plateforme. Cela ne vous dispensera pas de créer la base de données, y ajouter les bons rôles et configurer pdm de manière appropriée selon la méthode expliquée ci-dessus.
Docker-compose permet seulement de faciliter l'execution d'une instance déjà fonctionnelle si et seulement si elle a été configurée correctement préalablement.

En fonction de la configuration de votre serveur Postgresql, vous devrez certainement adapter la valeur de la variable `DB_URL` dans le fichier compose pour permettre au serveur pdm d'accéder à la base de données correctement.

N'essayez pas de débuter la configuration d'une instance avec docker-compose, essayez plutôt d'obtenir une configuration fonctionnelle de chaque composant et de vous assurer que tout fonctionne séparément d'abord.
Une fois que vous avez constaté que tout fonctionnait, lancez-vous avec docker-compose pour faciliter les executions futures.

Pour démarrer :

```
docker-compose up
```

Pour arrêter :

```
docker-compose down
```

### Locale

L'execution locale nécessite un serveur node conforme à la compatilité ci-dessus et des tâches planifiées pour tenir la base de données à jour.

Pour lancer le site web :

```bash
export DB_URL="postgres://user:password@host:5432/database" # Database URL
export PORT=3000 # Nodejs port (defaults to 3000)
npm run start
```

Le site est accessible à cette url [localhost:3000](http://localhost:3000).
