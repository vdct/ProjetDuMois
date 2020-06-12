#!/bin/bash

#set -e 
set -x

# on supprime yesterday et on renomme today en yesterday
rm -R yesterday
mv today/ yesterday/
mkdir today

# on télécharge le fichier france (avec métadonnées)
wget "http://download.openstreetmap.fr/extracts/europe/france-latest.osm.pbf" --no-verbose --output-document=france.osm.pbf 2>&1

# on extrait les données d'intérêts dans today (à partir des id de yesterday), en pbf puis json
osmium getid --id-osm-file yesterday/covid19.osm.pbf france.osm.pbf -o today/covid_to_check.osm.pbf

osmium export today/covid_to_check.osm.pbf -o today/covid_to_check.json -n -c export_config.json

# on récupère les scores utilisateurs
python3 get_user_score_increment_for_today.py

# on extrait les objets qui ont tjs un tag covid19 (en pbf et json) pour demain
osmium tags-filter france.osm.pbf /*:covid19 -o today/covid19.osm.pbf -R
osmium export today/covid19.osm.pbf -o today/covid.json -c export_config.json

## NB: pour l'initialisation et le premier lancement, créer le dossier today et lancer les deux dernières commandes
