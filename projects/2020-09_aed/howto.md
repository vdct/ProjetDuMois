L'objectif est de compléter autant que possible la liste des défibrillateurs dans OpenStreetMap. Pour cela, il y a deux façons principales de participer :

* Parcourir votre quartier ou votre ville et trouver les défibrillateurs manquants : ceux-ci sont installés dans les [établissements recevant du public](https://solidarites-sante.gouv.fr/prevention-en-sante/preserver-sa-sante/article/les-defibrillateurs-automatises-externes-dae) (magasins, administrations, équipements sportifs...). Chaque commune dispose généralement d'au moins un défibrillateur en un lieu central. Les grandes villes en ont un peu partout.
* Vérifier et intégrer les défibrillateurs listés sur la carte : ceux-ci sont extraits de bases officielles ([GéoDAE](https://geodae.atlasante.fr/apropos), collectivités territoriales) mais peuvent être positionnés approximativement. Sur la base de votre connaissance locale ou de visites terrain, ajoutez-les dans OSM.

Pour ajouter un défibrillateur, les attributs principaux sont les suivants :

* `emergency=defibrillator` : ceci est un défibrillateur (important)
* `defibrillator:location=*` : description textuelle de la localisation (optionnel)
* `access=yes/customers/private` : qui peut accéder au défibrillateur (optionnel)
* `indoor=yes` : si défibrillateur à l'intérieur d'un bâtiment
* `level=*` : numéro du niveau où se trouve le défibrillateur si en intérieur (0 = rez-de-chaussée, 1 = 1er étage...)
