# Contribuer au développement de ProjetDuMois.fr

## Dépendances

* NodeJS >= 9
* Curl, Awk, Grep, Sed, xsltproc
* PostgreSQL >= 10
* Python 3
* [Osmium](https://osmcode.org/osmium-tool/)
* [osmctools](https://wiki.openstreetmap.org/wiki/Osmupdate)
* [Imposm](https://imposm.org/) >= 3
* [pg_tileserv](https://github.com/CrunchyData/pg_tileserv)
* Dépendances de [sendfile_osm_oauth_protector](https://github.com/geofabrik/sendfile_osm_oauth_protector#requirements)


## Installation

```bash
git clone https://github.com/vdct/ProjetDuMois.git
cd ProjetDuMois
git submodule update --init
npm install
```


## Configuration générale

La configuration générale de l'outil est à renseigner dans `config.json`. Un modèle est proposé dans le fichier `config.example.json`. Les paramètres sont les suivants :

* `OSM_USER` : nom d'utilisateur OpenStreetMap pour la récupération de l'historique des modifications avec métadonnées
* `OSM_PASS` : mot de passe associé au compte utilisateur OSM
* `OSM_API_KEY` : clé d'API OSM
* `OSM_API_SECRET` : secret lié à la clé d'API OSM
* `OSH_PBF_URL` : URL du fichier OSH.PBF (historique et métadonnées, exemple `https://osm-internal.download.geofabrik.de/europe/france/reunion-internal.osh.pbf`)
* `DB_NAME` : nom de la base PostgreSQL (exemple `pdm`)
* `DB_HOST` : nom d'hôte de la base PostgreSQL (exemple `localhost`)
* `DB_PORT` : numéro de port de la base PostgreSQL (exemple `5432`)*
* `DB_USE_IMPOSM_UPDATE` : Active ou désactive l'intégration d'imposm3 (permet d'utiliser une base existante et tenue à jour par d'autres moyens)
* `WORK_DIR` : dossier de téléchargement et stockage temporaire (doit pouvoir contenir le fichier OSH PBF, exemple `/tmp/pdm`)
* `OSM_URL` : instance OpenStreetMap à utiliser (exemple `https://www.openstreetmap.org`)
* `JOSM_REMOTE_URL` : adresse du serveur JOSM à contacter (exemple `http://localhost:8111`)
* `OSMOSE_URL` : instance Osmose à utiliser (exemple `https://osmose.openstreetmap.fr`)
* `NOMINATIM_URL` : instance de Nominatim à utiliser (exemple `https://nominatim.openstreetmap.org`)
* `MAPILLARY_URL` : instance Mapillary à utiliser (exemple `https://www.mapillary.com`)
* `REPOSITORY_URL` : URL du dépôt du logiciel (exemple `https://github.com/vdct/ProjetDuMois`)
* `PDM_TILES_URL` : URL d'accès au service *pg_tileserv*, qui met à disposition les couches dans votre base de données
* `GEOJSON_BOUNDS` : objet de type `Geometry` (polygone ou multipolygone) en GeoJSON délimitant la zone où rechercher des notes OSM

### Connection à Postgresql

Aucun identifiant ni mot de passe ne sont ajoutés à la configuration de l'application.
Ajoutez un fichier ~/.pgpass (chmod 600) pour l'utilisateur applicatif afin de permettre à psql ou ses dépendances de s'authentifier.

Voir https://www.postgresql.org/docs/current/libpq-pgpass.html

## Configuration des projets

Chaque projet est défini via un sous-répertoire de `projects`. Chaque sous-répertoire doit contenir les fichiers suivants :

* `info.json` : métadonnées du projet
* `howto.md` : descriptif des tâches à réaliser au format Markdown (utiliser les niveaux de titres >= 3)
* `analysis.sql` : script SQL qui interprète la table des changements sur les objets OSM pertinents

Les propriétés dans `info.json` sont les suivantes :

* `id` : identifiant de la mission (caractères autorisés : A-Z, 0-9, _ et -)
* `title` : nom de la mission (assez court)
* `start_date` : date de début de la mission (format AAAA-MM-JJ)
* `end_date` : date de fin de la mission (format AAAA-MM-JJ)
* `summary` : résumé de la mission
* `links` : définition des URL pour les liens vers des pages tierces (wiki OSM)
* `database.osmium_tag_filter` : filtre Osmium sur les tags à appliquer pour ne conserver que les objets OSM pertinents (par exemple `nwr/*:covid19`, [syntaxe décrite ici](https://osmcode.org/osmium-tool/manual.html#filtering-by-tags))
* `database.imposm` : configuration pour l'import des données actualisées d'OSM (`types` pour les types de géométrie à prendre en compte, `mapping` pour les attributs, voir [la documentation Imposm](https://imposm.org/docs/imposm3/latest/mapping.html#tags) pour le format de ces champs)
* `database.compare` : configuration pour la recherche d'objets OpenStreetMap à comparer, suit le format de `database.imposm` avec une propriété supplémentaire `radius` (rayon de rapprochement en mètres)
* `datasources` : liste des sources de données qui apparaissent sur la page (voir ci-dessous)
* `statistics` : configuration de l'affichage des statistiques sur la page du projet
* `statistics.count` : activer le comptage des objets dans OSM
* `statistics.feature_name` : nom à afficher à l'utilisateur pour ces objets
* `statistics.osmose_tasks` : nom des tâches accomplies via Osmose
* `statistics.points` : configuration des points obtenus selon le type de contribution (en lien avec `analysis.sql`)
* `editors` : configuration spécifique à chaque éditeur OSM. Pour iD, il est possible d'utiliser [les paramètres listés ici](https://github.com/openstreetmap/iD/blob/develop/API.md).

### Se passer d'imposm3

Il est possible de ne pas utiliser imposm3 et de se connecter à une base de données pourvue des données nécessaires.
Il faudra s'assurer qu'elle est tenue à jour toutes les heures minimum pour les besoins de PdM.

Dans le cas où imposm3 serait désactivé, il faudra produire des vues matérialisées pour chaque projet configurés appelées `pdm_project_${project_id}`, avec la structure suivante:

```sql
osm_id BIGINT,
name VARCHAR(255)
tags hstore
geom GEOMETRY
```

Optionellement, si le mode compare est activé dans un projet donné, une vue supplémentaire appelée `pdm_project_${project_id}_compare` conforme à ce qui doit être comparé est nécessaire. Elle a la même structure que ci-dessus.

### Sources de données

Plusieurs sources de données sont mobilisables, et sont à faire apparaître dans le champ `datasources` du fichier `info.json`.

#### Osmose

[Osmose](https://wiki.openstreetmap.org/wiki/Osmose) est un outil d'analyse qualité et d'aide à l'intégration de données ouvertes. Les propriétés à renseigner sont les suivantes :

* `source` : type de source, valeur obligatoire `osmose`
* `item` : numéro d'item (code à quatre chiffres)
* `class` : (optionel) numéro de classe (code à plusieurs chiffres)
* `country` : (optionel) motif de nom de pays Osmose (exemple `france*`)
* `name` : nom à faire apparaître à l'utilisateur
* `subtitles` : (optionel) objet clé > valeur pour remplacer les sous-titres des signalements Osmose (recherche par motif)
* `buttons` : libellé à faire apparaître sur les boutons d'édition (exemple `{ "done": "C'est fait", "false": "Rien ici" }`)

#### Notes OSM

Les [notes OpenStreetMap](https://wiki.openstreetmap.org/wiki/Notes) sont une méthode simple pour envoyer des commentaires textuels par dessus la carte, et faciliter la contribution par des publics novices. Les propriétés à renseigner sont les suivantes :

* `source` : type de source, valeur obligatoire `notes`
* `name` : nom à faire apparaître à l'utilisateur
* `description` : texte descriptif indiquant la méthode de résolution d'une note
* `terms` : liste des termes à rechercher dans les notes (au singulier)
* `buttons` : libellé à faire apparaître sur les boutons d'édition (exemple `{ "close": "C'est fait" }`)

#### Objets OpenStreetMap

Les objets actuellement présents dans OpenStreetMap peuvent être affichés pour éviter les doublons et permettre leur édition. Les propriétés à renseigner sont les suivantes :

* `source` : type de source, valeur obligatoire `osm`
* `name` : nom à faire apparaître à l'utilisateur
* `description` : texte descriptif de l'objet affiché

Cette source ne peut apparaître qu'une seule fois, et correspond aux objets recherchés dans les options `database` de `info.json`.

#### Objets OpenStreetMap pour comparaison

Des objets indirectement liés au projet mais pertinents pour la contribution peuvent également apparaître. Les propriétés à renseigner sont les suivantes :

* `source` : type de source, valeur obligatoire `osm-compare`
* `name` : nom à faire apparaître à l'utilisateur
* `description` : texte descriptif de l'objet affiché

Cette source ne peut apparaître qu'une seule fois, et correspond aux objets recherchés dans les options `database.compare` de `info.json`.


## Base de données

La base de données s'appuie sur PostgreSQL. Pour créer la base :

```bash
psql -c "CREATE DATABASE pdm"
psql -d pdm -f db/00_init.sql

npm run features:update
./db/21_features_update_tmp.sh init
```

Le script suivant est à lancer quotidiennement pour récupérer les statistiques de contribution (notes, objets ajoutés, badges obtenus) :

```bash
npm run project:update
./db/09_project_update_tmp.sh
```

Le script suivant est à lancer chaque heure pour mettre à jour les objets venant d'OpenStreetMap à afficher sur la carte :

```bash
npm run features:update
./db/21_features_update_tmp.sh
```


## Site web

Le code de l'interface web se trouve dans le dossier `website`. Il s'agit d'un serveur [ExpressJS](http://expressjs.com/), combiné à des modèles [Pug](https://pugjs.org).

Pour lancer le site web :

```bash
export PGUSER=`whoami` # Nom d'utilisateur pour accéder à la base de données
npm run start
```

Le site est visible à l'adresse [localhost:3000](http://localhost:3000).

Les modèles Pug sont dans le sous-dossier `templates`. Celui-ci est organisé selon la logique suivante :

* Dans `templates`, le modèle général `layout.pug` et son fichier CSS
* Dans `common`, les éléments génériques à toutes les pages (`<head>`, en-tête, pied de page)
* Dans `components`, les composants principaux qui peuplent les pages (carte, bloc statistiques...)
* Dans `pages`, chacune des pages du site (accueil, carte, page projet...)
