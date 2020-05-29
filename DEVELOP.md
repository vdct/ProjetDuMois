# Contribuer au développement de ProjetDuMois.fr

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


## Site web

Le code de l'interface web se trouve dans le dossier `website`. Il s'agit d'un serveur [ExpressJS](http://expressjs.com/), combiné à des modèles [Pug](https://pugjs.org).
