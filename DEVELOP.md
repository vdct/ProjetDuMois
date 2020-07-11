# Contribuer au développement de ProjetDuMois.fr

## Dépendances

* NodeJS >= 9
* Wget
* PostgreSQL >= 10


## Installation

```bash
git clone https://github.com/vdct/ProjetDuMois.git
cd ProjetDuMois
npm install
```


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
* `datasources` : liste des sources de données qui apparaissent sur la page (signalements Osmose)
* `editors` : configuration spécifique à chaque éditeur OSM. Pour iD, il est possible d'utiliser [les paramètres listés ici](https://github.com/openstreetmap/iD/blob/develop/API.md).
* `database.osmium_tag_filter` : filtre Osmium sur les tags à appliquer pour ne conserver que les objets OSM pertinents (par exemple `nwr/*:covid19`, [syntaxe décrite ici](https://osmcode.org/osmium-tool/manual.html#filtering-by-tags))


## Base de données

La base de données s'appuie sur PostgreSQL. Pour créer la base :

```bash
psql -c "CREATE DATABASE pdm"
psql -d pdm -f db/00_init.sql
```

Pour mettre à jour quotidiennement la base avec les nouvelles contributions :

```bash
npm run project:update
```


## Site web

Le code de l'interface web se trouve dans le dossier `website`. Il s'agit d'un serveur [ExpressJS](http://expressjs.com/), combiné à des modèles [Pug](https://pugjs.org).

Pour lancer le site web :

```bash
npm run start
```

Le site est visible à l'adresse [localhost:3000](http://localhost:3000).
