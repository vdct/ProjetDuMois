# Contribuer au développement de ProjetDuMois.fr

## Dépendances

* NodeJS >= 9
* Curl, Awk, Grep, Sed
* PostgreSQL >= 10
* Python 3
* [Osmium](https://osmcode.org/osmium-tool/)
* [osmctools](https://wiki.openstreetmap.org/wiki/Osmupdate)
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
* `DB_PORT` : numéro de port de la base PostgreSQL (exemple `5432`)
* `DB_USER` : nom d'utilisateur pour la base PostgreSQL (exemple `postgres`)
* `DB_PASS` : mot de passe pour la base PostgreSQL (exemple `postgres`)
* `WORK_DIR` : dossier de téléchargement et stockage temporaire (doit pouvoir contenir le fichier OSH PBF, exemple `/tmp/pdm`)
* `OSM_URL` : instance OpenStreetMap à utiliser (exemple `https://www.openstreetmap.org`)
* `JOSM_REMOTE_URL` : adresse du serveur JOSM à contacter (exemple `http://localhost:8111`)
* `OSMOSE_URL` : instance Osmose à utiliser (exemple `https://osmose.openstreetmap.fr`)
* `NOMINATIM_URL` : instance de Nominatim à utiliser (exemple `https://nominatim.openstreetmap.org`)
* `MAPILLARY_URL` : instance Mapillary à utiliser (exemple `https://www.mapillary.com`)
* `REPOSITORY_URL` : URL du dépôt du logiciel (exemple `https://github.com/vdct/ProjetDuMois`)


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
* `datasources` : liste des sources de données qui apparaissent sur la page (signalements Osmose, notes OSM)
* `statistics` : configuration de l'affichage des statistiques sur la page du projet
* `editors` : configuration spécifique à chaque éditeur OSM. Pour iD, il est possible d'utiliser [les paramètres listés ici](https://github.com/openstreetmap/iD/blob/develop/API.md).


## Base de données

La base de données s'appuie sur PostgreSQL. Pour créer la base :

```bash
psql -c "CREATE DATABASE pdm"
psql -d pdm -f db/00_init.sql
```

Pour mettre à jour quotidiennement la base avec les nouvelles contributions :

```bash
npm run project:update
./db/09_project_update_tmp.sh
```


## Site web

Le code de l'interface web se trouve dans le dossier `website`. Il s'agit d'un serveur [ExpressJS](http://expressjs.com/), combiné à des modèles [Pug](https://pugjs.org).

Pour lancer le site web :

```bash
npm run start
```

Le site est visible à l'adresse [localhost:3000](http://localhost:3000).

Les modèles Pug sont dans le sous-dossier `templates`. Celui-ci est organisé selon la logique suivante :

* Dans `templates`, le modèle général `layout.pug` et son fichier CSS
* Dans `common`, les éléments génériques à toutes les pages (`<head>`, en-tête, pied de page)
* Dans `components`, les composants principaux qui peuplent les pages (carte, bloc statistiques...)
* Dans `pages`, chacune des pages du site (accueil, carte, page projet...)
