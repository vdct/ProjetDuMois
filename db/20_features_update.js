const CONFIG = require('../config.json');
const fs = require('fs');
const projects = require('../website/projects');
const yaml = require('js-yaml');

/*
 * Generates 21_features_update_tmp.sh
 * in order to update minutely/hourly OSM features
 */

// Constants
const OSM_PBF_LATEST = CONFIG.WORK_DIR + '/' + CONFIG.OSH_PBF_URL.split("/").pop().replace(".osh.pbf", ".osm.pbf");
const OSM_PBF_LATEST_UNSTABLE = OSM_PBF_LATEST.replace(".osm.pbf", ".new.osm.pbf");
const OSM_PBF_LATEST_UNSTABLE_FILTERED = OSM_PBF_LATEST.replace(".osm.pbf", ".new-local.osm.pbf");
const OSM_POLY = OSM_PBF_LATEST.replace("-internal.osm.pbf", ".poly");
const IMPOSM_ENABLED = CONFIG.hasOwnProperty("DB_USE_IMPOSM_UPDATE") ? CONFIG.DB_USE_IMPOSM_UPDATE : true;
const IMPOSM_YML = CONFIG.WORK_DIR + '/imposm.yml';
const IMPOSM_CACHE_DIR = CONFIG.WORK_DIR + '/imposm_cache';
const IMPOSM_DIFF_DIR = CONFIG.WORK_DIR + '/imposm_diffs';
const OSC_FULL = CONFIG.WORK_DIR + '/changes_features.osc.gz';
const OSC_LOCAL = CONFIG.WORK_DIR + '/changes_features.local.osc.gz';
const PSQL_DB = `postgres://${CONFIG.DB_HOST}:${CONFIG.DB_PORT}/${CONFIG.DB_NAME}`;
const OUTPUT_SCRIPT = __dirname+'/21_features_update_tmp.sh';
const UNINSTALL_SCRIPT = __dirname+'/91_project_uninstall_tmp.sql';

// Generate Imposm YAML config file
const yamlData = {
	tables: {
		'boundary': {
			type: 'polygon',
			mapping: { boundary: ['administrative'] },
			filters: {
				require: { 'admin_level': ['4','6','8'] }
			},
			columns: [
				{ name: 'osm_id', type: 'id' },
				{ name: 'name', key: 'name', type: 'string' },
				{ name: 'admin_level', key: 'admin_level', type: 'integer' },
				{ name: 'tags', type: 'hstore_tags' },
				{ name: 'geom', type: 'geometry' }
			]
		}
	},
	tags: { load_all: true }
};

const preSQL = [
	"DROP MATERIALIZED VIEW IF EXISTS pdm_boundary_tiles CASCADE",
	"DROP MATERIALIZED VIEW IF EXISTS pdm_boundary_subdivide CASCADE"
]; // Suppression des ressources projets
const postSQL = []; // Creation des ressources projets
const postUpdateSQL = [];

Object.entries(projects).forEach(e => {
	const [ id, project ] = e;
	
	if (IMPOSM_ENABLED) {
		const tableData = {
			mapping: project.database.imposm.mapping,
			columns: [
				{ name: 'osm_id', type: 'id' },
				{ name: 'name', key: 'name', type: 'string' },
				{ name: 'tags', type: 'hstore_tags' },
				{ name: 'geom', type: 'geometry' }
			]
		};

		project.database.imposm.types.forEach(type => {
			yamlData.tables[`project_${id.split("_").pop()}_${type}`] = Object.assign({ type }, tableData);
		});

		preSQL.push(`DROP VIEW IF EXISTS pdm_project_${id.split("_").pop()} CASCADE`);
		postSQL.push(
			`CREATE OR REPLACE VIEW pdm_project_${id.split("_").pop()} AS `
			+ project.database.imposm.types.map(type => {
				const osmid = type === "point" ? "CONCAT('node/', osm_id) AS osm_id" : "CASE WHEN osm_id < 0 THEN CONCAT('relation/', -osm_id) ELSE CONCAT('way/', osm_id) END AS osm_id";
				const geom = type === "point" ? "geom::GEOMETRY(Point, 3857)" : "ST_PointOnSurface(geom)::GEOMETRY(Point, 3857) AS geom";
				return `SELECT ${osmid}, name, hstore_to_json(tags) AS tags, tags ?| ARRAY['note','fixme'] AS needs_check, ${geom} FROM pdm_project_${id.split("_").pop()}_${type}`
			}).join(" UNION ALL ")
		);
	}

	// Comparison tables
	if(project.database.compare) {
		// Table definition
		if (IMPOSM_ENABLED){
			project.database.compare.types.forEach(type => {
				yamlData.tables[`project_${id.split("_").pop()}_compare_${type}`] = Object.assign({ type }, tableData, { mapping: project.database.compare.mapping });
			});

			preSQL.push(`DROP VIEW IF EXISTS pdm_project_${id.split("_").pop()}_compare CASCADE`);
			postSQL.push(
				`CREATE OR REPLACE VIEW pdm_project_${id.split("_").pop()}_compare AS `
				+ project.database.compare.types.map(type => {
					const osmid = type === "point" ? "CONCAT('node/', osm_id) AS osm_id" : "CASE WHEN osm_id < 0 THEN CONCAT('relation/', -osm_id) ELSE CONCAT('way/', osm_id) END AS osm_id";
					const geom = type === "point" ? "geom::GEOMETRY(Point, 3857)" : "ST_Centroid(geom)::GEOMETRY(Point, 3857) AS geom";
					return `SELECT ${osmid}, name, hstore_to_json(tags) AS tags, ${geom} FROM pdm_project_${id.split("_").pop()}_compare_${type}`
				}).join(" UNION ALL ")
			);
		}

		preSQL.push(`DROP MATERIALIZED VIEW IF EXISTS pdm_project_${id.split("_").pop()}_compare_tiles`);
		postSQL.push(
			`CREATE MATERIALIZED VIEW IF NOT EXISTS pdm_project_${id.split("_").pop()}_compare_tiles AS SELECT * FROM pdm_project_${id.split("_").pop()}_compare WHERE osm_id NOT IN (SELECT DISTINCT c.osm_id FROM pdm_project_${id.split("_").pop()}_compare c, pdm_project_${id.split("_").pop()} b WHERE ST_DWithin(c.geom, b.geom, ${project.database.compare.radius}))`
		);
		postSQL.push(`CREATE INDEX ON pdm_project_${id.split("_").pop()}_compare_tiles USING GIST(geom)`);
		postUpdateSQL.push(`REFRESH MATERIALIZED VIEW pdm_project_${id.split("_").pop()}_compare_tiles`);

		preSQL.push(`DROP VIEW IF EXISTS pdm_project_${id.split("_").pop()}_compare_tiles_filtered CASCADE`);
		postSQL.push(
			`CREATE VIEW pdm_project_${id.split("_").pop()}_compare_tiles_filtered AS SELECT a.* FROM pdm_project_${id.split("_").pop()}_compare_tiles a LEFT JOIN pdm_compare_exclusions b ON b.project = '${id}' AND a.osm_id = b.osm_id WHERE b.osm_id IS NULL`
		);
	}
});

if (IMPOSM_ENABLED){
	fs.writeFile(IMPOSM_YML, yaml.safeDump(yamlData), err => {
		if(err) {
			throw new Error(err);
		}
	});
}

// View for multi-type layers
const sqlToFull = sqlin => sqlin.map(vs => (`psql "${PSQL_DB}" -c "${vs}"`)).join("\n\t\t");
const sqlToScript = sqlin => sqlin.map(vs => (`${vs};`)).join("\n\t");
const preSQLFull = preSQL.length > 0 ? sqlToFull(preSQL) : "";
const postSQLFull = postSQL.length > 0 ? sqlToFull(postSQL) : "";
const postUpdateSQLFull = postUpdateSQL.length > 0 ? sqlToFull(postUpdateSQL) : "";


// Script text
const separator = `echo "-------------------------------------------------------------------"
echo ""`;

var script = `#!/bin/bash

# Script for updating OSM features for each project
# Generated automatically by npm run features:update

set -e

mode="$1"
if [ "$mode" == "" ]; then
	mode="update"
fi
`;

if (IMPOSM_ENABLED){
	script += `
echo "==== Get latest changes"
prev_timestamp=""
if [ -f ${CONFIG.WORK_DIR}/osh_timestamp ]; then
	prev_timestamp=$(cat ${CONFIG.WORK_DIR}/osh_timestamp)
fi

osmupdate --keep-tempfiles --trust-tempfiles --hour \\
	-t="${CONFIG.WORK_DIR}/osmupdate/" \\
	-v "${OSM_PBF_LATEST}" $prev_timestamp \\
	"${OSC_FULL}"
osmium apply-changes "${OSM_PBF_LATEST}" \\
	"${OSC_FULL}" \\
	-O -o "${OSM_PBF_LATEST_UNSTABLE}"
osmium extract -p "${OSM_POLY}" -s smart -S types=boundary,multipolygon "${OSM_PBF_LATEST_UNSTABLE}" -O -o "${OSM_PBF_LATEST_UNSTABLE_FILTERED}"
rm -f "${OSM_PBF_LATEST_UNSTABLE}" "${OSC_FULL}"
${separator}

if [ "$mode" == "init" ]; then
	echo "==== Initial import with Imposm"
	rm -f "${OSM_PBF_LATEST}" "${OSC_LOCAL}"
	mv "${OSM_PBF_LATEST_UNSTABLE_FILTERED}" "${OSM_PBF_LATEST}"
	mkdir -p "${IMPOSM_CACHE_DIR}"
	imposm import -mapping "${IMPOSM_YML}" \\
		-read "${OSM_PBF_LATEST}" \\
		-overwritecache -cachedir "${IMPOSM_CACHE_DIR}" \\
		-diff -diffdir "${IMPOSM_DIFF_DIR}"

	echo "Pre SQL..."
	${preSQLFull}

	imposm import -write \\
		-connection "${PSQL_DB}?prefix=pdm_" \\
		-mapping "${IMPOSM_YML}" \\
		-cachedir "${IMPOSM_CACHE_DIR}" \\
		-dbschema-import public -diff

	echo "Post SQL..."
	${postSQLFull}
	psql "${PSQL_DB}" -f "${__dirname}/22_features_post_init.sql"
else
	echo "==== Apply latest changes to database"
	osmium derive-changes "${OSM_PBF_LATEST}" "${OSM_PBF_LATEST_UNSTABLE_FILTERED}" -o "${OSC_LOCAL}"
	imposm diff -mapping "${IMPOSM_YML}" \\
		-cachedir "${IMPOSM_CACHE_DIR}" \\
		-dbschema-production public \\
		-connection "${PSQL_DB}?prefix=pdm_" \\
		"${OSC_LOCAL}"

	echo "Post Update SQL..."
	${postUpdateSQLFull}
	rm -f "${OSM_PBF_LATEST}" "${OSC_LOCAL}"
	mv "${OSM_PBF_LATEST_UNSTABLE_FILTERED}" "${OSM_PBF_LATEST}"
fi
`;
}
else {
	script += `
if [ "$mode" == "init" ]; then
	echo "Pre SQL..."
	${preSQLFull}

	echo "Post SQL..."
	${postSQLFull}
	psql "${PSQL_DB}" -f "${__dirname}/22_features_post_init.sql"
else
	echo "Post Update SQL..."
	${postUpdateSQLFull}
fi
`;
}
script += `${separator}

echo "Done"
`;

// Script de mise à jour
fs.writeFile(OUTPUT_SCRIPT, script, { mode: 0o766 }, err => {
	if(err) { throw new Error(err); }
	console.log("Update script done");
});

// Ecriture du script d'uninstall des projets
fs.writeFile(UNINSTALL_SCRIPT, sqlToScript(preSQL), { mode: 0o766 }, err => {
	if(err) { throw new Error(err); }
	console.log("Uninstall script done");
});
