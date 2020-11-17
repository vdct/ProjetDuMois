# Contribute to the development of ProjetDuMois.fr

## Dependencies

* NodeJS >= 9
* Curl, Awk, Grep, Sed, xsltproc
* PostgreSQL >= 10
* Python 3
* [Osmium](https://osmcode.org/osmium-tool/)
* [osmctools](https://wiki.openstreetmap.org/wiki/Osmupdate)
* [Imposm](https://imposm.org/) >= 3
* [pg_tileserv](https://github.com/CrunchyData/pg_tileserv)
* Dependencies of [sendfile_osm_oauth_protector](https://github.com/geofabrik/sendfile_osm_oauth_protector#requirements)


## Installation

```bash
git clone https://github.com/vdct/ProjetDuMois.git
cd ProjetDuMois
git submodule update --init
npm install
```


## General configuration

The general configuration of the tool is to be filled in `config.json`. There is a suggested model in the `config.example.json` file. The parameters are as follows:

* `OSM_USER`: OpenStreetMap username for retrieving the modification history with metadata
* `OSM_PASS`: password associated with the OSM user account
* `OSM_API_KEY`: OSM API key
* `OSM_API_SECRET`: secret linked to the OSM API key
* `OSH_PBF_URL`: URL of the OSH.PBF file (history and metadata, example `https://osm-internal.download.geofabrik.de/europe/france/reunion-internal.osh.pbf`)
* `DB_NAME`: name of the PostgreSQL database (example `pdm`)
* `DB_HOST`: hostname of the PostgreSQL database (example `localhost`)
* `DB_PORT`: port number of the PostgreSQL database (example `5432`)
* `DB_USER`: username for the PostgreSQL database (example `postgres`)
* `DB_PASS`: password for the PostgreSQL database (example `postgres`)
* `WORK_DIR`: download and temporary storage folder (must have capacity to store the OSH PBF file, example `/tmp/pdm`)
* `OSM_URL`: OpenStreetMap instance to use (example `https://www.openstreetmap.org`)
* `JOSM_REMOTE_URL`: address of the JOSM server to reach (example `http://localhost:8111`)
* `OSMOSE_URL`: Osmose instance to use (example `https://osmose.openstreetmap.fr`)
* `NOMINATIM_URL`: instance of Nominatim to use (example `https://nominatim.openstreetmap.org`)
* `MAPILLARY_URL`: Mapillary instance to use (example `https://www.mapillary.com`)
* `REPOSITORY_URL`: URL of the software repository (example `https://github.com/vdct/ProjetDuMois`)
* `PDM_TILES_URL`: URL to access the *pg_tileserv* service, which provides the layers in your database
* `GEOJSON_BOUNDS`: object of `Geometry` type (polygon or multipolygon) in GeoJSON delimiting the area to search for OSM notes.


## Project configuration

Each project is defined via a subdirectory of `projects'. Each subdirectory must contain the following files :

* `info.json` : project metadata
* `howto.md`: description of tasks to be performed in Markdown format (use title levels >= 3)
* `analysis.sql`: SQL script that interprets the table of changes on the relevant OSM objects

The properties in `info.json` are as follows:

* `id`: mission identifier (authorized characters: A-Z, 0-9, _ and -)
* `title`: name of the mission (short enough)
* `start_date`: start date of the mission (format YYYYY-MM-DD)
* `end_date`: end date of the mission (format YYYYY-MM-DD)
* `summary`: summary of the mission
* `links`: definition of the URLs for links to third party pages (OSM wiki)
* `database.osmium_tag_filter` : Osmium filter on the tags to be applied to keep only the relevant OSM objects (for example `nwr/*:covid19`, [syntax described here](https://osmcode.org/osmium-tool/manual.html#filtering-by-tags))
* `database.imposm`: configuration for importing updated OSM data (`types` for geometry types to be taken into account, `mapping` for attributes, see [the Imposm documentation](https://imposm.org/docs/imposm3/latest/mapping.html#tags) for the format of these fields)
* `database.compare`: configuration for the search of OpenStreetMap objects to compare, follows the format of `database.imposm` with an additional property `radius` (reconciliation radius in meters)
* `datasources`: list of data sources that appear on the page (see below)
* `statistics`: configuration of statistics display on the project page
* `statistics.count`: enable object counting in OSM
* `statistics.feature_name`: name to display to the user for these objects
* `statistics.osmose_tasks`: name of the tasks performed via Osmose
* `statistics.points`: configuration of the points obtained according to the type of contribution (in relation with `analysis.sql`)
* `editors`: specific configuration to each OSM editor. For iD, it is possible to use [the parameters listed here](https://github.com/openstreetmap/iD/blob/develop/API.md).

### Data sources

Several data sources can be used, and are to be displayed in the `datasources` field of the `info.json` file.

#### Osmose

[Osmose](https://wiki.openstreetmap.org/wiki/Osmose) is a tool for quality analysis and open data integration. The properties to be filled in are the following:

* `source`: source type, mandatory value `osmose`
* `item`: item number (four-digit code)
* `class` : (optional) class number (multi-digit code)
* `country` : (optional) Osmose country name pattern (example `france*`)
* `name`: name to be displayed to the user
* `subtitles` : (optional) key object > value to replace the subtitles of Osmose reports (search by pattern)
* `buttons` : label to be displayed on the edit buttons (example `{ "done": "It's done", "false": "Nothing here" }`)

#### OSM Notes

The [OpenStreetMap notes](https://wiki.openstreetmap.org/wiki/Notes) are a simple method for sending text comments on the map, and facilitate contribution by novice audiences. The properties to be filled in are the following:

* `source`: source type, mandatory value `notes`
* `name`: name to be displayed to the user
* `description`: descriptive text explaining the resolution method for a note
* `terms`: list of terms to search for in the notes (singular)
* `buttons` : label to display on the edit buttons (example `{ "close": "It's done" }`)

#### OpenStreetMap objects

Objects currently present in OpenStreetMap can be displayed to avoid duplicates and allow editing. The properties to be filled in are the following:

* `source`: source type, mandatory value `osm`
* `name`: name to be displayed to the user
* `description` : descriptive text of the displayed object

This source can appear only once, and corresponds to the objects searched for in the `database` options of `info.json`.

#### OpenStreetMap objects for comparison

Objects indirectly related to the project but relevant to the contribution may also appear. The properties to be filled in are the following:

* `source`: type of source, mandatory value `osm-compare`
* `name`: name to be displayed to the user
* `description` : descriptive text of the displayed object

This source can only appear once, and corresponds to the objects searched for in the `database.compare` options of `info.json`.


## Database

The database relies on PostgreSQL. To create the database :

```bash
psql -c "CREATE DATABASE pdm"
psql -d pdm -f db/00_init.sql

npm run features:update
./db/21_features_update_tmp.sh init
```

The following script has to be launched daily to retrieve the contribution statistics (notes, objects added, badges obtained):

```bash
npm run project:update
./db/09_project_update_tmp.sh
```

The following script has to be run every hour to update the objects coming from OpenStreetMap to be displayed on the map:

```bash
npm run features:update
./db/21_features_update_tmp.sh
```


## Website

The code for the web interface can be found in the `website` folder. This is an [ExpressJS](http://expressjs.com/) server, combined with [Pug](https://pugjs.org) templates.

To launch the web site :

```bash
npm run start
```

The site can be viewed at [localhost:3000](http://localhost:3000).

The Pug templates are in the `templates` sub-folder. It is organized according to the following logic:

* In `templates`, the general model `layout.pug` and its CSS file
* In `common`, generic elements to all pages (`<head>`, header, footer)
* In `components`, the main components that populate the pages (map, statistics block...)
* In `pages`, each page of the site (home, map, project page...)

