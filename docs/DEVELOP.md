# Running of ProjetDuMois.fr

## Dependencies

- NodeJS >= 18
- Bash tools : curl, awk, grep, sed, bc
- PostgreSQL >= 13
- Python 3 (and `requests` module)
- [Osmium](https://osmcode.org/osmium-tool/) > 1.10
- [osmctools](https://wiki.openstreetmap.org/wiki/Osmupdate)
- [Imposm](https://imposm.org/) >= 3
- [pg_tileserv](https://github.com/CrunchyData/pg_tileserv)
- Dependencies of [sendfile_osm_oauth_protector](https://github.com/geofabrik/sendfile_osm_oauth_protector#requirements)

### Osmium building

ProjetDuMois requires a recent version of osmium as it takes advantage to newest tags-filter abilities.
Not many Linux distros got the appropriate package available in their repositories and you may need to build your own binary of osmium.

See guidelines on the [official README](https://github.com/osmcode/osmium-tool/blob/master/README.md#building).

Following packets on debian can be useful

- build-essential
- cmake
- zlib1g-dev
- libbz2-dev
- liblz4-dev
- libboost-dev
- libboost-program-options-dev

## Getting started

```bash
git clone https://github.com/vdct/ProjetDuMois.git
cd ProjetDuMois
git submodule update --init
```

## General configuration

The general configuration of the tool is to be filled in `config.json`. There is a suggested model in the `config.example.json` file. The parameters are as follows:

- `OSM_USER`: OpenStreetMap username for retrieving the modification history with metadata
- `OSM_PASS`: password associated with the OSM user account
- `OSM_CLIENT_ID` : client ID associated with the OSM account
- `OSH_PBF_AUTHORIZED`: Enable OAuth2 authentication to download OSH files when necessary. To be disabled if the repository selected in `OSH_PBF_URL` doesn't support it.
- `OSH_PBF_URL`: URL of the OSH.PBF file (history and metadata, example `https://osm-internal.download.geofabrik.de/europe/france/reunion-internal.osh.pbf`)
- `OSM_PBF_URL`: URL of the OSM.PBF file (current state, example `https://download.geofabrik.de/europe/france-latest.osm.pbf`). This file isn't covered by authorization process.
- `POLY_URL`: URL of a polygon file holding the perimeter in which projects are considered (example `https://download.geofabrik.de/europe/france.poly`). This file isn't covered by authorization process.
- `DB_USE_IMPOSM_UPDATE` : enable or disabled Imposm3 integration (to use an existing database which would be maintained by other means, by default `true`)
- `WORK_DIR`: download and temporary storage folder (must have capacity to store the OSH PBF file, example `/tmp/pdm`)
- `OSM_URL`: OpenStreetMap instance to use (example `https://www.openstreetmap.org`)
- `OSM_API_URL` : API OpenStreetMap instance to use (example `https://www.api.openstreetmap.org`)
- `JOSM_REMOTE_URL`: address of the JOSM server to reach (example `http://localhost:8111`)
- `OSMOSE_URL`: Osmose instance to use (example `https://osmose.openstreetmap.fr`)
- `NOMINATIM_URL`: instance of Nominatim to use (example `https://nominatim.openstreetmap.org`)
- `MAPILLARY_URL`: Mapillary instance to use (example `https://www.mapillary.com`)
- `MAPILLARY_API_KEY`: Mapillary API key ([could be created here](https://www.mapillary.com/dashboard/developers))
- `MATOMO_HOST`: URL to the Matomo host you want to report analytics to, with trailing /. Remove to disable. (example `https://stats.home.com/`). 
- `MATOMO_SITE`: ID of the Matomo website you want to report analytics (example `6`)
- `REPOSITORY_URL`: URL of the software repository (example `https://github.com/vdct/ProjetDuMois`)
- `VECT_STYLE` : URL to [Maplibre GL compatible style](https://maplibre.org/maplibre-gl-js/docs/) (example `https://tile-vect.openstreetmap.fr/styles/liberty/style.json`)
- `PDM_TILES_URL`: URL to access the _pg_tileserv_ service, which provides the layers in your database
- `GEOJSON_BOUNDS`: object of `Geometry` type (polygon or multipolygon) in GeoJSON delimiting the area to search for OSM notes.
- `MAINTENANCE_MODE`: optional flag to display a notice page on website when doing maintenance (set to `true` to enable)

### Postgresql connection

As to connect to any Postgresql host, `DB_URL` environement variable is expected to be set with a conninfo string.
This is necessary for standalone or Docker environments.

```bash
export DB_URL="postgres://user:password@host:5432/database"
```

See also 33.1.1 chapter about [Postgresql conninfo strings](https://www.postgresql.org/docs/13/libpq-connect.html).

## Project configuration

Each project is defined via a subdirectory of `projects'. Each subdirectory must contain the following files :

- `info.json` : project metadata
- `howto.md`: description of tasks to be performed in Markdown format (use title levels >= 3)
- `contribs.sql` : SQL script containing UPDATE request on `pdm_features` table, to set contribution classes to certain type of OSM changes and associate points
- `extract.sh` : Optional script that produces a csv export to be available for download on the web interface.

The properties in `info.json` are as follows:

- `id`: Unique integer identifier
- `name`: mission identifier (authorized characters: A-Z, 0-9, \_ and -)
- `title`: name of the mission (short enough)
- `start_date`: start date of the mission (format YYYYY-MM-DD)
- `end_date`: end date of the mission (format YYYYY-MM-DD)
- `soft_end_date`: end date of the _strong_ community animation period (format YYYYY-MM-DD). This is only informational, it doesn't affect backend processing.
- `summary`: summary of the mission
- `links`: definition of the URLs for links to third party pages (OSM wiki)
- `database.osmium_tag_filter` : Osmium filter on the tags to be applied to keep only the relevant OSM objects (for example `nwr/*:covid19`, [syntax described here](https://osmcode.org/osmium-tool/manual.html#filtering-by-tags)). It is possible to list many filters using `&` character and same syntax.
- `database.imposm`: configuration for importing updated OSM data (`types` for geometry types to be taken into account, `mapping` for attributes, see [the Imposm documentation](https://imposm.org/docs/imposm3/latest/mapping.html#tags) for the format of these fields)
- `database.compare`: configuration for the search of OpenStreetMap objects to compare, follows the format of `database.imposm` with an additional property `radius` (reconciliation radius in meters)
- `datasources`: list of data sources that appear on the page (see below)
- `statistics`: configuration of statistics display on the project page
- `statistics.count`: enable object counting in OSM
- `statistics.feature_name`: name to display to the user for these objects
- `statistics.osmose_tasks`: name of the tasks performed via Osmose
- `statistics.points`: configuration of the points obtained according to the type of contribution (in relation with `contribs.sql`)
- `editors`: specific configuration to each OSM editor. ProjetDuMois is described below, for iD, it is possible to use [the parameters listed here](https://github.com/openstreetmap/iD/blob/develop/API.md).

### Projects timeline

Each project comes with its own timeline definition. It will influence several processings to keep change log up to date along time.  
Script `project:update` will automatically chose the most appropriate data source to feed the necessary update for each project:
- OSH files which provide all features with they history, over a given geographical area. They are released each month.
- Daily diffs which expose changes that occured during a given day worldwide.

ProjetDuMois allows whether daily update and complete rebuild of a terminated project history over the whole time period. This second option is particularly useful in case of significant change in the software or in the project extent.
A project can be configured without end date, with `end_date: null`, to enable endless updates.

![Supported projects timelines](./projects_process.svg)
- 1st case: An old project with an end date which completely fits in the OSH file availbility. It doesn't need updates but can be reinit on demand.
- 2nd case: An old project without end date, too old to be updated with diffs files and requires to be reinited to reach current date.
- 3rd case: An old project without end date, recently updated and for which daily diffs update are applicable until current date.
- 4th case: An old project with an end date in the future, on which daily diffs updates are applicable until current date.
- 5th case: A recently began project with an end date in the future, on which daily diffs updates are applicable until current date.
- 6th case: A project to began in the future, which doesn't require any processing currently.

### Features counts

Features counts are done over change log fed by update and filtered by each project's own configuration. Counting features is enabled with the help of `statistics.count` flag.  
Computing suh statistics not only requires existence dates of each version but their validity regarding the project's filter as well.

Each possible configuration can be summarised in this chart: 
![Counting features along time](./projects_counts.svg)
Some features may have a complex timeline, gaining and losing tags and validity regarding a given project several times.

Dates on which features are counted are selected by the processing script following a precise logic. The span on which the script is used impacts the way those dates are selected. Starting from the current date, we keep the following:
- Each day at midnight until last count update or 1st day of the current month
- First day of each month until the last count update or begining of the project

Running the count script each day will lead to 364 values at the end of a complete year.

W currently support the following counts:
- Total amount of features that valides the project's filter on a given date.

### Filtering features

ProjetDuMois makes use of Osmium and Imposm to filter necessary features according to each project's configuration, with the help of `database.osmium_tag_filter` and `database.imposm` keys.

Documented syntax of filters is available in [Osmium documentation online](https://docs.osmcode.org/osmium/latest/osmium-tags-filter.html). However, due to the need to apply those filters at severel steps of the processing, including outside of Osmium logic, filters that would use `!=` operator aren't currently supported.

### Disable imposm3 usage

Is it possible to not use imposm3 and provide an updated database with all necessary data.  
You must ensure yourself it will be updated at the necessary pace for PdM need, at least daily.

#### Common principles

A table `pdm_boundary` with every administrative boundaries will be useful to aggregate statistics at several levels. [Administrative boundaries](https://wiki.openstreetmap.org/wiki/Tag:boundary%3Dadministrative) 2, 4, 6 and 8 are supported by web interface.  
It should conform to this structure:

```sql
id INT
osm_id BIGINT
name VARCHAR
admin_level INT
tags HSTORE
geom GEOMETRY(Geometry, 3857)
centre GEOMETRY(Point, 3857)
```

`centre` column contains a point that must be inside the boundary perimeter (please use [ST_PointOnSurface](https://postgis.net/docs/ST_PointOnSurface.html) function).  
Indices should be created on columns `osm_id`, `tags`, `geom` and `centre` depending on the amount of boundaries covering each project.

Processing will automatically derivate another table `pdm_boundary_subdivide` by using [ST_Subdivide](https://postgis.net/docs/ST_Subdivide.html) as to significantly ease the intersecting computation between features and boundaries.

Once updated, use the following to propagate the changes you have made to the boundaries:

```sql
REFRESH MATERIALIZED VIEW pdm_boundary_subdivide;
```

#### Replace by another database
In case you have access to your own database already updated outside of PdM, you should produce a materialized view for each active project, called `pdm_project_${project_slug}` that conforms to following structure:

```sql
osm_id varchar,
gid bigint,
name VARCHAR(255)
tags json
geom GEOMETRY
```

Optionally, if the compare mode is enabled for a given project, a supplemntary view called `pdm_project_${project_id}_compare` that conforms to the given structure for `pdm_project_${project_id}` is needed.

#### Replace by the changelog
If you accept to only have a daily update to most statsitics, which means without instant update when some features get edited along the day, it is possible to create a materialized view as such:

```sql
create materialized view pdm_project_projectslug as
  select fc.osmid as osm_id, 
  split_part(fc.osmid, '/', 2)::bigint as gid, 
  fc.tags->>'name' as name, 
  to_json(fc.tags) as tags, 
  fc.geom 
  from pdm_features_projectslug_changes fc
  where fc.tagsfilter=true and (CURRENT_TIMESTAMP BETWEEN fc.ts_start AND fc.ts_end
        OR (CURRENT_TIMESTAMP > fc.ts_start AND fc.ts_end is null));
```

Please mind refreshing it every day.

### Data sources

Several data sources can be used, and are to be displayed in the `datasources` field of the `info.json` file.

#### Osmose

[Osmose](https://wiki.openstreetmap.org/wiki/Osmose) is a tool for quality analysis and open data integration. The properties to be filled in are the following:

- `source` (mandatory `osmose`): source type
- `item`: item number (four-digit code)
- `class` (optional): class number (multi-digit code)
- `country` (optional): Osmose country name pattern (example `france*`)
- `name`: name to be displayed to the user
- `subtitles` (optional): key object > value to replace the subtitles of Osmose reports (search by pattern)
- `buttons`: label to be displayed on the edit buttons (example `{ "done": "It's done", "false": "Nothing here" }`)
- `minzoom` (default 7): minimum zoom level for making this layer visible
- `maxzoom` (default 18): maximum zoom level for making this layer visible
- `tiles` (default): TMS URL list

#### OSM Notes

The [OpenStreetMap notes](https://wiki.openstreetmap.org/wiki/Notes) are a simple method for sending text comments on the map, and facilitate contribution by novice audiences. The properties to be filled in are the following:

- `source` (mandatory `notes`): source type
- `name`: name to be displayed to the user
- `description`: descriptive text explaining the resolution method for a note
- `terms`: list of terms to search for in the notes (singular)
- `buttons`: label to display on the edit buttons (example `{ "close": "It's done" }`)
- `data` (default): data in Geojson format

#### OpenStreetMap objects

Objects currently present in OpenStreetMap can be displayed to avoid duplicates and allow editing. The properties to be filled in are the following:

- `source` (mandatory `osm`): source type
- `name`: name to be displayed to the user
- `description`: descriptive text of the displayed object
- `minzoom` (default 7): minimum zoom level for making this layer visible
- `maxzoom` (default 14): maximum zoom level for making this layer visible
- `tiles` (default): TMS URL list
- `layers` (default): Layer names list to use and corresponding to `tiles` indices

This source can appear only once, and corresponds to the objects searched for in the `database` options of `info.json`.

#### OpenStreetMap objects for comparison

Objects indirectly related to the project but relevant to the contribution may also appear. The properties to be filled in are the following:

- `source` (mandatory `osm-compare`): type of source
- `name`: name to be displayed to the user
- `description`: descriptive text of the displayed object
- `minzoom` (default 9): minimum zoom level for making this layer visible
- `maxzoom` (default 14): maximum zoom level for making this layer visible
- `tiles` (default): TMS URL list
- `layers` (default): Layer names list to use and corresponding to `tiles` indices

This source can only appear once, and corresponds to the objects searched for in the `database.compare` options of `info.json`.

#### OpenStreetMap extra objects

Objects outside the project's scope, displayed as to inform contributors that something different already exists in place. The properties to be filled in are the following:

- `source` (mandatory `osm-extra`): type of source
- `name`: name to be displayed to the user
- `description`: descriptive text of the displayed object
- `minzoom` (default 9): minimum zoom level for making this layer visible
- `maxzoom` (default 14): maximum zoom level for making this layer visible
- `tiles` (default): TMS URL list
- `layers` (default): Layer names list to use and corresponding to `tiles` indices

This source can appear as many time as required

#### Background imagery

Raster tile imagery can be added in background to make contribution easier or give context. You have to define following properties:

- `source` (mandatory `background`): type of source
- `icon` (default `other`): symbol to display in legend (between `aerial`, `thematic`, `picture`, `other`)
- `name`: name shown to users
- `tiles` (default): list of TMS URL
- `attribution`: attribution to display on map
- `minzoom` (default 2): minimum zoom level for making this layer visible
- `maxzoom` (default 19): maximum zoom level for making this layer visible
- `tileSize` (default 256): width and length of a tile in pixels

These sources should be declared in reverse order of display. The lower layer should be declared first.

#### Sources stats

Another kind of datasource can be added and refers to geographical statistics, over administrative boundaries for instance

- `source` (mandatory `stats`): statistics source type
- `minzoom` (default 2): minimum zoom level for making this layer visible
- `maxzoom` (default 14): maximum zoom level for making this layer visible
- `tiles` (default): list of TMS URL
- `layers` (default): Layer names list to use and corresponding to `tiles` indices

### Projet du Mois integrated editor

Project configuration allows to customize embedded editor with appropriate fields. Let's consider following json to be set in the `editors` list:

```json
"pdm": {
  "fields": [
    ... fields list...
  ],
  "title": {
    "add": "Add action label",
    "edit": "Edit action label"
  }
}
```

Fields are defined with standard JSON objects added to the `fields` array in the uspide json.
Every type except `hidden` supports those common attributes:

- `name`: Field name to be displayed to the user
- `help`: HREF link to a relevant help page regarding this particular field
- `description`: An extensive text displayed to the user providing details about the field
- `optional`: A boolean false/true field making the field respectively mandatory or not

#### Static or external attributes

Define static tags to be added to every created object by the editor, or retrieve existing values from external sources (like identifiers from Osmose such as `ref:FR:SIRET` tag, use in that case `*` value).

```json
{ "type": "hidden", "tags": { "tag_1": "value_1", "tag_2": "value_2", "external_tag_3": "*" } }
```

#### Scalar field

Text fields comes with 3 different types: text, number or email.
They're all producing a standard text field, leading to a given OSM key with appropriate validation features.

```json
  { "type": "text", "name": "Field label", "tag": "tag_key", "optional": false },
  { "type": "number", "name": "Field label", "tag": "tag_key", "optional": false },
  { "type": "email", "name": "Field label", "tag": "tag_key", "optional": false }
```

#### Textarea field

A wider textarea field similar to text one.

```json
{ "type": "textarea", "name": "Field label", "tag": "tag_key", "optional": false }
```

#### Drop down list

A drop down list with custom entries leading to a given OSM tag

```json
{
  "type": "select",
  "name": "Field label",
  "tag": "tag_key",
  "optional": false,
  "values": [
    { "v": "value_1", "l": "Value 1 label" },
    { "v": "value_2", "l": "Value 2 label" }
  ]
}
```

You can also set multiple tags using a single value in the list, for example:

```json
{
  "type": "select",
  "name": "Type",
  "tag": "_select1",
  "values": [
    {
      "l": "National police",
      "tags": { "name": "National police", "operator": "National police", "police:FR": "police" }
    },
    { "l": "City police", "tags": { "name": "City police", "police:FR": "police_municipale" } }
  ]
}
```

In case of multiple tags for a single value, you can force removal of certain tags with empty strings, for example to cover objects that belongs to different categories:

```json
{
  "type": "select",
  "name": "Type de commerce",
  "tag": "_select1",
  "values": [
    { "l": "Agence d'assurance", "tags": { "shop": "", "office": "insurance" } },
    { "l": "Agence de voyages", "tags": { "shop": "travel_agency", "office": "" } }
  ]
}
```

#### 2 or 3 states

States input are using radio buttons to provide 2 or 3 options to the user. It leads to a given OSM key.
`2states` is yes/unknown and `3states` is yes/no/unknown.

```json
  { "type": "2states", "name": "Field label", "tag": "tag_key"},
  { "type": "3states", "name": "Field label", "tag": "tag_key"}
```

#### Brands and operators

To make brand or operators input easier, you can use the `nsi` field (related to [Name Suggestion Index](https://nsi.guide/), a collaborative listing of all brands and operators worldwide). It has specific options:

- `path` : path to brand listing to use (this appears in website title, for example `brands/shop/coffee`)
- `locationSet` : a two-letter, lowercase country code to only list brands from this specific country (optional)

For example:

```json
{ "type": "nsi", "name": "Brand", "path": "brands/shop/bakery", "locationSet": "fr" }
```

#### Icons group

Icon select fields allow simple selecting of several similar attributes, for example available sockets at a charging station or kind of waste accepted in a recycling container. Icons must be available in the `/website/images/form` folder, as PNG image. Tags associated to an icon are applied on feature if icon is selected.

```json
{
  "type": "icons",
  "name": "Available sockets",
  "tag": "_socket",
  "values": [
    { "icon": "socket_typee", "label": "TE", "tags": { "socket:typee": "yes" } },
    { "icon": "socket_type2", "label": "T2", "tags": { "socket:type2": "yes" } },
    { "icon": "socket_type2_combo", "label": "T2 Combo", "tags": { "socket:type2_combo": "yes" } },
    { "icon": "socket_chademo", "label": "Chademo", "tags": { "socket:chademo": "yes" } }
  ]
}
```

### Feature counts and statistics

Project statistics are made by `./db/31_projects_update_tmp.sh` script. This script fills `pdm_feature_counts` SQL table with missing daily data according to last OSH file timestamp and current day.

It is possible to force full recount for a project by deleting OSH timestamp file, retreive again PBF/PBH files and launch again the script:

```bash
rm ${WORK_DIR}/osh_timestamp
./db/11_pbf_update_tmp.sh
./db/31_projects_update_tmp.sh
```

#### Points and contributions

Certain OSM contributions can give points to users.
Each project configuration set how many points are given according to the type of contribution.
By default, the platform create the following contribution types:

- `add`: changes concerning features with version=1 (creation)
- `edit` : changes concerning features version>1 (tag or geometry edits)

It is possible to attribute your own type for each project by creating a `contribs.sql` file next to `info.json`.
This script contains UPDATE SQL requests to add entries in `pdm_features` table. Each OSM change can only have a single type and have a single amount of points associated.

Configuration of points is in `info.json`:

```json
{
  "statistics": {
    "points": { "add": 3, "project1": 1 }
  }
}
```

## Build

Once PDM has been properly configured, you should choose between Docker or standalone to build it.
Refers to Database section in run chapter to make ProjetDuMois fully runable.

### git submodules

ProjetDuMois relies on some git submodules. Please mind using the following to retreive them prior to build

```sh
git submodule init
git submodule update
```

### Docker build

You can build a node.js based ProjetDuMois server including necessary features to run. It includes osmium 1.10.0 with Debian Buster.
It doesn't includes a PgSQL server. You can use [CampToCamp Postgres image](https://hub.docker.com/r/camptocamp/postgres/tags?page=1&ordering=last_updated).

```bash
docker build [--build-arg IMPOSM3_VERSION=0.11.0] [--build-arg CONFIG=./config.json] -t pdm/server:latest .
```

Where:

- IMPOSM3_VERSION: Version of imposm3 to use in the docker image
- CONFIG : Path towards the config file to be used (defaults to `./config.json`)

### Standalone instance

```bash
npm install
```

## Run

### Database

The database relies on PostgreSQL. To create the database, as a superuser :

```bash
psql -c "CREATE DATABASE pdm"
psql -c "CREATE EXTENSION IF NOT EXISTS postgis"
psql -c "CREATE EXTENSION IF NOT EXISTS hstore"
```

### pg_tileserv

#### Without Docker

As pg_tileserv is required to display osm data on the map, you'll have to install it or use the image include in docker-compose file.
You will need `wget` and `unzip` to use it.

```bash
# download latest build
wget https://postgisftw.s3.amazonaws.com/pg_tileserv_latest_linux.zip
# unzip / delete it
unzip pg_tileserv_latest_linux.zip -d /opt/pg_tileserv
rm pg_tileserv_latest_linux.zip
# specify database url to connect
export DATABASE_URL=postgres://postgres:password@pdm-db:5432/pdm
# launch it
cd /opt/pg_tileserv
./pg_tileserv
```

#### Using Docker

You can use the image in docker-compose.yml or for a lightweight image you should build yourself the [alpine Dockerfile](https://github.com/CrunchyData/pg_tileserv/blob/master/Dockerfile.alpine)
It's possible to install pg_tileserv in pdm Dockerfile before building the image. But it's not recommended.

### Docker

Database is installed and inited simply with:

```bash
docker run --rm [--network=your-network] -e DB_URL=postgres://user:password@host:5432/database pdm/server:latest install
docker run --rm [--network=your-network] -v host_work_dir:container_work_dir -e DB_URL=postgres://user:password@host:5432/database pdm/server:latest init
```
Second command will init each project in the database. It can lead to significant process times depending on chosen perimeter.
And then run the server with:

```bash
docker run -d --rm [--network=your-network] -p 3000:3000 --name=pdm -v host_work_dir:container_work_dir -e DB_URL=postgres://user:password@host:5432/database pdm/server:latest run
```

Don't forget to add following lines into your crontab for periodic updates, for example daily updates:

```bash
docker run --rm [--network=your-network] -v host_work_dir:container_work_dir -e DB_URL=postgres://user:password@host:5432/database pdm/server:latest update_daily
```

Individual updates are also available for punctual calls:

```bash
docker run --rm [--network=your-network] -v host_work_dir:container_work_dir -e DB_URL=postgres://user:password@host:5432/database pdm/server:latest update_features
docker run --rm [--network=your-network] -v host_work_dir:container_work_dir -e DB_URL=postgres://user:password@host:5432/database pdm/server:latest update_changes
docker run --rm [--network=your-network] -v host_work_dir:container_work_dir -e DB_URL=postgres://user:password@host:5432/database pdm/server:latest update_projects
```
See below for the related documentation.

If you use Imposm updates, you may start and let run another container that handles regular updates as well:

```bash
docker run --rm [--network=your-network] -v host_work_dir:container_work_dir -e DB_URL=postgres://user:password@host:5432/database pdm/server:latest update_imposm
```

### Standalone

Database relies on PostgreSQL. To install the schema before first run:

```bash
psql -d pdm -f db/00_init.sql
```

The following script is to run to retreive and update changes:

```bash
npm run features:update
./db/11_features_update_tmp.sh
```
It supports two modes:
* init, downloads an OSM.pbf file and use imposm to import it in database
* update, to refresh materialized views.

The following script is to run after first initialization of database to create list of OSM features:

```bash
npm run features:update
./db/21_features_update_tmp.sh {init,update}
```
It supports two modes:
* init, to fill each project changelog on the whole period between their start and now
* update, to fill each project changelog on the whole period since their last update and now

The following script has to be launched daily to retrieve the contribution statistics (notes, objects added, badges obtained):

```bash
npm run projects:update
./db/31_projects_update_tmp.sh
```

## Website

The code for the web interface can be found in the `website` folder. This is an [ExpressJS](http://expressjs.com/) server, combined with [Pug](https://pugjs.org) templates.

The Pug templates are in the `templates` sub-folder. It is organized according to the following logic:

- In `templates`, the general model `layout.pug` and its CSS file
- In `common`, generic elements to all pages (`<head>`, header, footer)
- In `components`, the main components that populate the pages (map, statistics block...)
- In `pages`, each page of the site (home, map, project page...)

The site can be viewed at [localhost:3000](http://localhost:3000).

### Docker

Docker image includes websites and background updating tasks.
You can run it with:

```bash
docker run -d --rm [--network=your-network] -p 3000:3000 --name=pdm -v host_work_dir:container_work_dir -e DB_URL=postgres://user:password@host:5432/database pdm/server:latest run
```

### Docker compose

A compose file is provided to ease the running processing. It won't prevent you from creating database, adding users and make the appropriate configuration nor building dockers as mentionned upside.
Docker compose only allows to run easilly a functionnal instance if and only it has already been properly configured before.

Depending on your Postgresql configuration, you'll surely have to customize the `DB_URL` env variable in the compose file to let the pdm server access the database safely.

Don't try to run the instance with docker-compose first, try to run each component separately and check if everything work as expected.
Once everything runs normally, you can use the following for further runs:

To start:

```
docker-compose up
```

To stop:

```
docker-compose down
```

### Standalone

Standalone running requires a node server complient with compatility at the top of this document and planned tasks to update projects regularly.

To launch the web site :

```bash
export DB_URL="postgres://user:password@host:5432/database" # Database URL
export PORT=3000 # Nodejs port (defaults to 3000)
npm run start
```

The site can be viewed at [localhost:3000](http://localhost:3000).
