# Contribuer au développement de ProjetDuMois.fr

## Dépendances

* NodeJS >= 9
* Wget


## Installation

```bash
git clone https://github.com/vdct/ProjetDuMois.git
cd ProjetDuMois
npm install
npm run start
```

Le site est visible à l'adresse [localhost:3000](http://localhost:3000).


## Configuration des projets

Chaque projet est défini via un sous-répertoire de `projects`. Chaque sous-répertoire doit contenir les fichiers suivants :

* `info.json` : métadonnées du projet
* `howto.md` : descriptif des tâches à réaliser au format Markdown (utiliser les niveaux de titres >= 3)

Les propriétés dans `info.json` sont les suivantes :

* `id` : identifiant de la mission (caractères autorisés : A-Z, 0-9, _ et -)
* `title` : nom de la mission (assez court)
* `start_date` : date de début de la mission (format AAAA-MM-JJ)
* `end_date` : date de fin de la mission (format AAAA-MM-JJ)
* `summary` : résumé de la mission
* `datasources` : liste des sources de données qui apparaissent sur la page (signalements Osmose)
* `editors` : configuration spécifique à chaque éditeur OSM. Pour iD, il est possible d'utiliser [les paramètres listés ici](https://github.com/openstreetmap/iD/blob/develop/API.md).


## Site web

Le code de l'interface web se trouve dans le dossier `website`. Il s'agit d'un serveur [ExpressJS](http://expressjs.com/), combiné à des modèles [Pug](https://pugjs.org).


## Base de données

Version basée sur les [fichiers historiques](https://osm-internal.download.geofabrik.de/europe/france-internal.osh.pbf) `.osh.pbf`

```bash
# Init structure
mkdir diffs
cd diffs

# Extract interesting features from history dump
OSH_FILE="diffs/bretagne-internal.osh.pbf"
osmium tags-filter ${OSH_FILE} -R nwr/*:covid19 -f osc \
	| xsltproc db/osc2csv.xslt - \
	| awk -F "\"*,\"*" '{print $2}' \
	| grep -v -E "^(osmid|)$" \
	| sed -r 's#([nwr])[a-z]+/([0-9]+)#\1\2#g' \
	| osmium getid ${OSH_FILE} -i - -f osc \
	| xsltproc db/osc2csv.xslt - \
	> diffs/changes.csv
```

Importer dans PostgreSQL

```sql
CREATE TABLE osm_history_covid19(
	action VARCHAR NOT NULL,
	osmid VARCHAR NOT NULL,
	version INT NOT NULL,
	ts TIMESTAMP NOT NULL,
	username VARCHAR NOT NULL,
	userid BIGINT NOT NULL,
	tags JSONB
);

\COPY osm_history_covid19 FROM '/home/adrien/Stockage/Code/ProjetDuMois/diffs/changes.csv' CSV HEADER QUOTE '"';

CREATE INDEX osm_history_covid19_action_idx ON osm_history_covid19(action);
CREATE INDEX osm_history_covid19_osmid_idx ON osm_history_covid19(osmid);
CREATE INDEX osm_history_covid19_version_idx ON osm_history_covid19(version);
```

Requête d'analyse pour détecter les modifications utilisateurs

```
```
