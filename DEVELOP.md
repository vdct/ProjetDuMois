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

# Extract interesting tags from history dump
osmium tags-filter diffs/reunion-internal.osh.pbf -R nwr/delivery,delivery:covid19,takeaway,takeaway:covid19,opening_hours,opening_hours:covid19 -o diffs/filtered.osm.pbf

# Output as OsmChange file
osmium cat diffs/filtered.osm.pbf -o diffs/filtered.osc.gz

# Convert OsmChange into CSV
xsltproc db/osc2csv.xslt diffs/filtered.osc.gz > diffs/changes.csv
```

Version alternative basée sur les [fichiers diff](https://wiki.openstreetmap.org/wiki/Planet.osm/diffs).

```bash
# Get diff files
osmupdate --minute --base-url=https://download.openstreetmap.fr/replication/merge/france_metro_dom_com_nc/ --keep-tempfiles 2020-05-01T00:00:00Z changes.osc.gz

# Create a CSV of all changes using XSLT
xsltproc db/osc2csv.xslt diffs/changes.osc.gz > diffs/changes.csv

# Curate CSV according to selected tags
head -n 1 diffs/changes.csv > diffs/changes_project.csv
grep -e '(""delivery""|""takeaway""|""opening_hours"")' diffs/changes.csv >> diffs/changes_project.csv
```
