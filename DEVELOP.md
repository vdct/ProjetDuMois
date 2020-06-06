# Contribuer au développement de ProjetDuMois.fr

## Dépendances

* NodeJS >= 9
* Wget
* osmconvert et [osmupdate](https://wiki.openstreetmap.org/wiki/Osmupdate)


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

Initialisation de la récupération des [fichiers diff](https://wiki.openstreetmap.org/wiki/Planet.osm/diffs).

```bash
mkdir diffs
cd diffs

osmupdate --minute --base-url=https://download.openstreetmap.fr/replication/merge/france_metro_dom_com_nc/ --keep-tempfiles 2020-05-01T00:00:00Z changes.osc.gz
osmconvert changes.osc.gz --csv="@oname @id @timestamp @changeset @uid @user opening_hours delivery drive_through takeaway" --csv-headline -o=changes.csv
```
