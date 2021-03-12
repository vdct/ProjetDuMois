# Contribute to the development of ProjetDuMois.fr

## Dependencies

* NodeJS >= 9
* Bash tools : curl, awk, grep, sed, xsltproc, bc
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
* `DB_USE_IMPOSM_UPDATE` : enable or disabled Imposm3 integration (to use an existing database which would be maintained by other means, by default `true`)
* `WORK_DIR`: download and temporary storage folder (must have capacity to store the OSH PBF file, example `/tmp/pdm`)
* `OSM_URL`: OpenStreetMap instance to use (example `https://www.openstreetmap.org`)
* `JOSM_REMOTE_URL`: address of the JOSM server to reach (example `http://localhost:8111`)
* `OSMOSE_URL`: Osmose instance to use (example `https://osmose.openstreetmap.fr`)
* `NOMINATIM_URL`: instance of Nominatim to use (example `https://nominatim.openstreetmap.org`)
* `MAPILLARY_URL`: Mapillary instance to use (example `https://www.mapillary.com`)
* `REPOSITORY_URL`: URL of the software repository (example `https://github.com/vdct/ProjetDuMois`)
* `MAPBOX_STYLE` : URL to [Mapbox GL compatible style](https://docs.mapbox.com/mapbox-gl-js/style-spec/) (example `https://tile-vect.openstreetmap.fr/styles/liberty/style.json`)
* `PDM_TILES_URL`: URL to access the *pg_tileserv* service, which provides the layers in your database
* `GEOJSON_BOUNDS`: object of `Geometry` type (polygon or multipolygon) in GeoJSON delimiting the area to search for OSM notes.

### Postgresql connection

No user or password are defined in application configuration. Create a `~/.pgpass` file for application user to allow psql or its dependencies to login.

See also https://www.postgresql.org/docs/current/libpq-pgpass.html


## Project configuration

Each project is defined via a subdirectory of `projects'. Each subdirectory must contain the following files :

* `info.json` : project metadata
* `howto.md`: description of tasks to be performed in Markdown format (use title levels >= 3)
* `contribs.sql` : SQL script containing UPDATE request on `pdm_changes` table, to set contribution classes to certain type of OSM changes and associate points

The properties in `info.json` are as follows:

* `id`: mission identifier (authorized characters: A-Z, 0-9, _ and -)
* `title`: name of the mission (short enough)
* `start_date`: start date of the mission (format YYYYY-MM-DD)
* `end_date`: end date of the mission (format YYYYY-MM-DD)
* `summary`: summary of the mission
* `links`: definition of the URLs for links to third party pages (OSM wiki)
* `database.osmium_tag_filter` : Osmium filter on the tags to be applied to keep only the relevant OSM objects (for example `nwr/*:covid19`, [syntax described here](https://osmcode.org/osmium-tool/manual.html#filtering-by-tags)). It is possible to list many filters using `&` character and same syntax. Only latest defined filter will be used for Osmium feature counts.
* `database.imposm`: configuration for importing updated OSM data (`types` for geometry types to be taken into account, `mapping` for attributes, see [the Imposm documentation](https://imposm.org/docs/imposm3/latest/mapping.html#tags) for the format of these fields)
* `database.compare`: configuration for the search of OpenStreetMap objects to compare, follows the format of `database.imposm` with an additional property `radius` (reconciliation radius in meters)
* `datasources`: list of data sources that appear on the page (see below)
* `statistics`: configuration of statistics display on the project page
* `statistics.count`: enable object counting in OSM
* `statistics.feature_name`: name to display to the user for these objects
* `statistics.osmose_tasks`: name of the tasks performed via Osmose
* `statistics.points`: configuration of the points obtained according to the type of contribution (in relation with `contribs.sql`)
* `editors`: specific configuration to each OSM editor. For iD, it is possible to use [the parameters listed here](https://github.com/openstreetmap/iD/blob/develop/API.md).

### Projects timing

It is possible to define projects occuring during overlapping time periods. The `project:update` script will only update currently active projects.

### Disable imposm3 usage

It is possible to not use Imposm3 and connect to an existing database already populated with necessary data.
You should make sure that it is correctly hourly-updated for this application needs.

In case Imposm3 is disabled, you have also to make available materialized views named `pdm_project_${project_id}`, with following structure:

```sql
osm_id BIGINT
name VARCHAR(255)
tags json
geom GEOMETRY
```

Optionally, if compare mode is enabled in a given project, another view `pdm_project_${project_id}_compare` containing data to which features should be compared is necessary. It has the same structure as described above.

In complement of these tables, you need a `pdm_boundary` table with administrative boundaries for your area ([administrative levels](https://wiki.openstreetmap.org/wiki/Tag:boundary%3Dadministrative) 4, 6 and 8) with following structure:

```sql
id INT
osm_id BIGINT
name VARCHAR
admin_level INT
tags HSTORE
geom GEOMETRY(Geometry, 3857)
```

Create indexes on `osm_id`, `tags` and `geometry` columns might be useful depending of your database content.

### Data sources

Several data sources can be used, and are to be displayed in the `datasources` field of the `info.json` file.

#### Osmose

[Osmose](https://wiki.openstreetmap.org/wiki/Osmose) is a tool for quality analysis and open data integration. The properties to be filled in are the following:

* `source` (mandatory `osmose`): source type
* `item`: item number (four-digit code)
* `class` (optional): class number (multi-digit code)
* `country` (optional): Osmose country name pattern (example `france*`)
* `name`: name to be displayed to the user
* `subtitles` (optional): key object > value to replace the subtitles of Osmose reports (search by pattern)
* `buttons`: label to be displayed on the edit buttons (example `{ "done": "It's done", "false": "Nothing here" }`)
* `minZoom` (default 7): minimum zoom level for making this layer visible
* `maxZoom` (default 18): maximum zoom level for making this layer visible
* `tiles` (default): TMS URL list

#### OSM Notes

The [OpenStreetMap notes](https://wiki.openstreetmap.org/wiki/Notes) are a simple method for sending text comments on the map, and facilitate contribution by novice audiences. The properties to be filled in are the following:

* `source` (mandatory `notes`): source type
* `name`: name to be displayed to the user
* `description`: descriptive text explaining the resolution method for a note
* `terms`: list of terms to search for in the notes (singular)
* `buttons`: label to display on the edit buttons (example `{ "close": "It's done" }`)
* `data` (default): data in Geojson format

#### OpenStreetMap objects

Objects currently present in OpenStreetMap can be displayed to avoid duplicates and allow editing. The properties to be filled in are the following:

* `source` (mandatory `osm`): source type
* `name`: name to be displayed to the user
* `description`: descriptive text of the displayed object
* `minZoom` (default 7): minimum zoom level for making this layer visible
* `maxZoom` (default 14): maximum zoom level for making this layer visible
* `tiles` (default): TMS URL list
* `layers` (default): Layer names list to use and corresponding to `tiles` indices

This source can appear only once, and corresponds to the objects searched for in the `database` options of `info.json`.

#### OpenStreetMap objects for comparison

Objects indirectly related to the project but relevant to the contribution may also appear. The properties to be filled in are the following:

* `source` (mandatory `osm-compare`): type of source, mandatory value `osm-compare`
* `name`: name to be displayed to the user
* `description`: descriptive text of the displayed object
* `minZoom` (default 9): minimum zoom level for making this layer visible
* `maxZoom` (default 14): maximum zoom level for making this layer visible
* `tiles` (default): TMS URL list
* `layers` (default): Layer names list to use and corresponding to `tiles` indices

This source can only appear once, and corresponds to the objects searched for in the `database.compare` options of `info.json`.

#### Background imagery

Raster tile imagery can be added in background to make contribution easier or give context. You have to define following properties:

* `source` (mandatory `background`): type of source
* `icon` (default `other`): symbol to display in legend (between `aerial`, `thematic`, `other`)
* `name`: name shown to users
* `tiles` (default): list of TMS URL
* `attribution`: attribution to display on map
* `minZoom` (default 2): minimum zoom level for making this layer visible
* `maxZoom` (default 19): maximum zoom level for making this layer visible
* `tileSize` (default 256): width and length of a tile in pixels

These sources should be declared in reverse order of display. The lower layer should be declared first.

#### Sources stats

Another kind of datasource can be added and refers to geographical statistics, over administrative boundaries for instance

* `source` (mandatory `stats`): statistics source type
* `minZoom` (default 2): minimum zoom level for making this layer visible
* `maxZoom` (default 14): maximum zoom level for making this layer visible
* `tiles` (default): list of TMS URL
* `layers` (default): Layer names list to use and corresponding to `tiles` indices

### Feature counts and statistics

Project statistics are made by `./db/09_project_update_tmp.sh` script. This script fills `pdm_feature_counts` SQL table with missing daily data according to last OSH file timestamp and current day.

It is possible to force full recount for a project by deleting OSH timestamp file and launch again the script:

```bash
rm ${WORK_DIR}/osh_timestamp
./db/09_project_update_tmp.sh
```

#### Points and contributions

Certain OSM contributions can give points to users.
Each project configuration set how many points are given according to the type of contribution.
By default, the platform create the following contribution types:
* `add`: changes concerning features with version=1 (creation)
* `edit` : changes concerning features version>1 (tag or geometry edits)

It is possible to attribute your own type for each project by creating a `contribs.sql` file next to `info.json`.
This script contains UPDATE SQL requests to add entries in `pdm_changes` table. Each OSM change can only have a single type and have a single amount of points associated.

Configuration of points is in `info.json`:

```json
{
    "statistics": {
		"points": { "add": 3, "project1": 1 }
    }
}
```


## Database

The database relies on PostgreSQL. To create the database :

```bash
psql -c "CREATE DATABASE pdm"
psql -d pdm -f db/00_init.sql
```

The following script has to be launched daily to retrieve the contribution statistics (notes, objects added, badges obtained):

```bash
npm run project:update
./db/09_project_update_tmp.sh
```

The following script is to run after first initialization of database to create list of OSM features:

```bash
npm run features:update
./db/21_features_update_tmp.sh init
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
export PGUSER=`whoami` # Database username
npm run start
```

The site can be viewed at [localhost:3000](http://localhost:3000).

The Pug templates are in the `templates` sub-folder. It is organized according to the following logic:

* In `templates`, the general model `layout.pug` and its CSS file
* In `common`, generic elements to all pages (`<head>`, header, footer)
* In `components`, the main components that populate the pages (map, statistics block...)
* In `pages`, each page of the site (home, map, project page...)
