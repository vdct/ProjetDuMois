Les bornes de recharge que nous recherchons ici sont toutes les installations sur le domaine public permettant la recharge des véhicules électriques. On les trouve particulièrement sur les parkings et à proximité d'axes routier dans tous les cas.

La page amenity=charging_station décrit en détail comment cartographier ces bornes de recharge. En voici un résumé.

### Cartographie de base

On cartographie l'emplacement de la borne avec un nœud node avec le tag amenity=charging_station

On y ajoutera :

* le ou les types de véhicules qui peuvent être chargés : motorcar=yes/no, bicycle=yes/no, scooter=yes/no
* le nombre de véhicules qui peuvent utiliser la borne en même temps : capacity=*
* s'il faut payer pour utiliser la borne : fee=yes/no
* les horaires d'accès à la station opening_hours=* (souvent 24/7)

Si la borne fait partie d'un réseau, on pourra également ajouter

* le nom commercial du réseau : network=*
* le nom de la borne ou station dans ce réseau, qui est affiché sur la borne : name=*
* l'éventuel numéro ou référence de la borne dans le réseau, qui est affiché sur la borne : ref=*
* l'opérateur qui gère le réseau : operator=*
* l'entité publique ou privée propriétaire des infrastructures, lorsqu'on la connaît : owner=*

Si la borne est positionnée dans un parking, on indiquera également le nombre total de places dédiées à la recharge avec le tag capacity:charging sur l'objet amenity=parking existant.

### Cartographie exhaustive

#### Prix, paiement et authentification

On indiquera prioritairement si l'usage de la borne est gratuite avec le tag fee=*.

Si l'usage de la borne est gratuit mais pas celui de la place de stationnement, on complétera avec le tag parking:fee=*.

Si le tarif est unique, on pourra utiliser le tag charge=* pour indiquer ce prix.

On pourra enfin renseigner la méthode d'authentification : carte d'abonné sur le réseau, NFC, appel téléphonique, etc. À noter qu'il peut être nécessaire de s'authentifier même si la recharge est gratuite.
Le détail des tags à utiliser est disponible sur [la page principale](https://wiki.openstreetmap.org/wiki/FR:Tag:amenity%3Dcharging_station#Authentification).

#### Prises et puissances

La disponibilité de telle ou telle prise est une information importante pour savoir si vous pourrez y brancher votre véhicule. La puissance électrique donne une idée de la vitesse de recharge.

Il est en général nécessaire d'être authentifié pour accéder aux prises (notamment lorsque l'utilisation de la borne est payante) mais ces informations sont parfois visibles et affichées sur les bornes.

On les cartographie avec les tags suivants :

* socket:<type>=number = Nombre de prises de ce type
* socket:<type>:output=kW = puissance de sortie maximale de la prise

Voici les principales prises que l'on retrouve en France :

* prises classiques domestiques : socket:typee=*
* type 2 : socket:type2=*
* type 2 combo ou CCS : socket:type2_combo=*
* CHAdeMO : socket:chademo=*
* type 3c : socket:type3c=*

Pour devenir un expert des différentes prises et les reconnaître en clin d’œil, [la page dédiée](https://wiki.openstreetmap.org/wiki/Key:socket) est votre meilleure alliée !
