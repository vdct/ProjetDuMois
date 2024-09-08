from utils import (
	CONFIG, PROJECTS, getCodePath, getWorkPath,
	dbCursor, runCmd, download, createMergedView,
	deployView, exportBounds,
)
import yaml
import json
import os
from psycopg.sql import SQL, Literal, Identifier


# Insert/update project metadata in database
print("Import projects in database")
with dbCursor() as cur:
	for pid, pinfo in PROJECTS.items():
		cur.execute(
			"""
			INSERT INTO pdm_projects(project, start_date, end_date)
			VALUES (%(id)s, %(sd)s, %(ed)s)
			ON CONFLICT (project) DO UPDATE SET start_date = %(sd)s, end_date = %(ed)s
			""",
			{"id": pid, "sd": pinfo.get("start_date"), "ed": pinfo.get("end_date")}
		)

		for contrib,value in pinfo.get("statistics").get("points").items():
			cur.execute(
				"""
				INSERT INTO pdm_projects_points(project, contrib, points)
				VALUES (%(id)s, %(c)s, %(p)s)
				ON CONFLICT (project, contrib) DO UPDATE SET points = %(p)s
				""",
				{"id": pid, "c": contrib, "p": value}
			)


# Imposm database update
if CONFIG.get("DB_USE_IMPOSM_UPDATE", True):
	OSM_PBF_FILE = getWorkPath("data.osm.pbf")
	download(CONFIG.get("OSM_PBF_URL"), OSM_PBF_FILE, "OSM PBF data")

	print("Generating Imposm configuration files")
	yamlData = {
		"tables": {
			"boundary_osm": {
				"type": "polygon",
				"mapping": { "boundary": ["administrative"] },
				"filters": {
					"require": { "admin_level": ["4","6","8"] }
				},
				"columns": [
					{ "name": "osm_id", "type": "id" },
					{ "name": "name", "key": "name", "type": "string" },
					{ "name": "admin_level", "key": "admin_level", "type": "integer" },
					{ "name": "tags", "type": "hstore_tags" },
					{ "name": "geom", "type": "geometry" }
				]
			}
		},
		"tags": { "load_all": True }
	}

	# Generate each project entries
	for pid, pinfo in PROJECTS.items():
		# Classic table
		pimposm = pinfo["database"].get("imposm")
		table = {
			"mapping": pimposm.get("mapping"),
			"columns": [
				{ "name": "osm_id", "type": "id" },
				{ "name": "name", "key": "name", "type": "string" },
				{ "name": "tags", "type": "hstore_tags" },
				{ "name": "geom", "type": "geometry" },
			]
		}

		for ttype in pimposm.get("types"):
			yamlData["tables"][f"project_{pinfo['short_id']}_{ttype}"] = { "type": ttype } | table.copy()
		
		# Compare table
		if pinfo["database"].get("compare") is not None:
			for ctype in pinfo["database"]["compare"].get("types"):
				yamlData["tables"][f"project_{pinfo['short_id']}_compare_{ctype}"] = table.copy() | { "type": ctype, "mapping": pinfo["database"]["compare"].get("mapping") }

	# Write final imposm.yml file
	IMPOSM_YML = getWorkPath("imposm.yml")
	with open(IMPOSM_YML, "w", encoding="utf-8") as f:
		yaml.dump(yamlData, f, default_flow_style=False, allow_unicode=True)
	
	# Write imposm config file
	IMPOSM_CONFIG = getWorkPath("imposm_config.json")
	with open(IMPOSM_CONFIG, "w", encoding="utf-8") as f:
		json.dump({
			"cachedir": getWorkPath("imposm_cache"),
			"connection": f"{os.getenv('DB_URL')}?prefix=pdm",
			"mapping": IMPOSM_YML,
			"diffdir": getWorkPath("imposm_diff"),
			"limitto": exportBounds(),
			"replication_url": CONFIG.get("OSM_REPLICATION_URL"),
			"replication_interval": "1m",
		}, f, indent=2)
	
	# Clean-up eventual views from previous imports
	print("Cleaning import schema")
	with dbCursor() as cur:
		cur.execute("DROP SCHEMA IF EXISTS import CASCADE")
		cur.execute("CREATE SCHEMA import")
	
	# Run Imposm import tasks
	print("Starting Imposm initial import")
	runCmd([
		"imposm", "import",
		"-config", IMPOSM_CONFIG,
		"-read", OSM_PBF_FILE,
		"-overwritecache", "-write", "-diff", "-optimize"
	])

	# Create many project views
	print("Creating PdM views")
	with dbCursor() as cur:
		# Boundaries
		print("  - Starting boundaries")
		cur.execute("""
			-- Boundary view
			CREATE MATERIALIZED VIEW import.pdm_boundary AS
			SELECT *, ST_Centroid(geom)::GEOMETRY(Point, 3857) AS centre
			FROM import.pdm_boundary_osm;

			CREATE INDEX ON import.pdm_boundary(osm_id);

			-- Boundary subdivide
			CREATE MATERIALIZED VIEW import.pdm_boundary_subdivide AS
			SELECT id, osm_id, name, admin_level, tags, ST_Subdivide(geom, 450) AS geom
			FROM import.pdm_boundary;

			CREATE INDEX ON import.pdm_boundary_subdivide using gist(geom);
			CREATE INDEX ON import.pdm_boundary_subdivide using btree(osm_id);
		""")

		# Per-project
		for pid, pinfo in PROJECTS.items():
			# Basic views
			print(f"  - Starting {pinfo["short_id"]}")
			createMergedView(cur, pinfo, pinfo["database"]["imposm"]["types"])

			# Compare views
			if pinfo["database"].get("compare") is not None:
				createMergedView(cur, pinfo, pinfo["database"]["compare"]["types"], "_compare")

				# Compare tiles
				pview = Identifier(f"pdm_project_{pinfo["short_id"]}")
				cview = Identifier(f"pdm_project_{pinfo["short_id"]}_compare")
				cviewtile = Identifier(f"pdm_project_{pinfo["short_id"]}_compare_tiles")
				cviewtilefilt = Identifier(f"pdm_project_{pinfo["short_id"]}_compare_tiles_filtered")
				cur.execute(SQL("""
					CREATE MATERIALIZED VIEW import.{cvt} AS
					SELECT *
					FROM import.{cv}
					WHERE osm_id NOT IN (
						SELECT DISTINCT c.osm_id
						FROM import.{cv} c,
							import.{pv} b
						WHERE ST_DWithin(c.geom, b.geom, {r})
					)
				""").format(
					pv=pview,
					cv=cview,
					cvt=cviewtile,
					r=Literal(pinfo["database"]["compare"]["radius"])
				))

				# Compare tiles filtered
				cur.execute(SQL("""
					CREATE VIEW import.{cvtf} AS
					SELECT a.*
					FROM import.{cvt} a
					LEFT JOIN pdm_compare_exclusions b
						ON b.project = {pid} AND a.osm_id = b.osm_id
					WHERE b.osm_id IS NULL
				""").format(
					pid=pid,
					cvtf=cviewtilefilt,
					cvt=cviewtile,
				))
		
	# Clean-up eventual views from previous imports
	print("Cleaning backup schema")
	with dbCursor() as cur:
		cur.execute("DROP SCHEMA IF EXISTS backup CASCADE")
		cur.execute("CREATE SCHEMA backup")
	
	# Switch import/prod schemas
	runCmd([
		"imposm", "import",
		"-config", IMPOSM_CONFIG,
		"-deployproduction"
	])

	# Do the switch for our views as well
	print("Deploying PdM views")
	with dbCursor() as cur:
		print("  - Boundaries")
		cur.execute("""
			ALTER MATERIALIZED VIEW IF EXISTS pdm_boundary SET SCHEMA backup;
			ALTER MATERIALIZED VIEW IF EXISTS pdm_boundary_subdivide SET SCHEMA backup;
			ALTER MATERIALIZED VIEW import.pdm_boundary SET SCHEMA public;
			ALTER MATERIALIZED VIEW import.pdm_boundary_subdivide SET SCHEMA public;

			-- Statistics per project and administrative boundary
			ALTER TABLE IF EXISTS pdm_features_boundary SET SCHEMA backup;
			ALTER TABLE IF EXISTS pdm_feature_counts_per_boundary SET SCHEMA backup;

			CREATE TABLE pdm_features_boundary (
				project VARCHAR,
				osmid VARCHAR,
				boundary BIGINT,
				start_ts TIMESTAMP,
				end_ts TIMESTAMP,
				PRIMARY KEY(project, osmid, boundary)
			);

			CREATE TABLE pdm_feature_counts_per_boundary(
				project VARCHAR NOT NULL,
				boundary BIGINT NOT NULL,
				ts DATE NOT NULL,
				amount INT NOT NULL,
				PRIMARY KEY(project, boundary, ts)
			);
		""")

		for pid, pinfo in PROJECTS.items():
			print(f"  - {pid} views")
			deployView(cur, Identifier(f"pdm_project_{pinfo["short_id"]}"))
			if pinfo["database"].get("compare") is not None:
				deployView(cur, Identifier(f"pdm_project_{pinfo["short_id"]}_compare"))
				deployView(cur, Identifier(f"pdm_project_{pinfo["short_id"]}_compare_tiles"), isMaterial=True)
				deployView(cur, Identifier(f"pdm_project_{pinfo["short_id"]}_compare_tiles_filtered"))
			
			cur.execute(SQL("""
				INSERT INTO pdm_features_boundary(project, osmid, boundary)
				SELECT %(pid)s, p.osm_id, b.osm_id
				FROM {table} p
				JOIN pdm_boundary_subdivide b ON ST_Within(p.geom, b.geom)
			""").format(
				table=Identifier(f"pdm_project_{pinfo["short_id"]}")
			), {
				"pid": pid
			})

		print("  - Post-process boundaries")
		cur.execute("""
			CREATE INDEX ON pdm_features_boundary(project, boundary);

			DROP MATERIALIZED VIEW IF EXISTS pdm_boundary_tiles;
			CREATE MATERIALIZED VIEW pdm_boundary_tiles AS
			WITH minc AS (
				SELECT DISTINCT ON (project, boundary) project, boundary, amount
				FROM pdm_feature_counts_per_boundary
				ORDER BY project, boundary, ts
			),
			maxc AS (
				SELECT DISTINCT ON (project, boundary) project, boundary, amount
				FROM pdm_feature_counts_per_boundary
				ORDER BY project, boundary, ts DESC
			),
			stats AS (
				SELECT project, boundary, json_object(array_agg(ts::date::text), array_agg(amount::text)) AS stats
				FROM pdm_feature_counts_per_boundary
				GROUP BY project, boundary
			)
			SELECT s.project, s.boundary, b.id, b.name, b.admin_level, s.stats, maxc.amount - minc.amount AS nb, b.centre AS geom
			FROM stats s
			JOIN minc ON minc.project = s.project AND minc.boundary = s.boundary
			JOIN maxc ON maxc.project = s.project AND maxc.boundary = s.boundary
			JOIN pdm_boundary b ON s.boundary = b.osm_id;

			CREATE INDEX ON pdm_boundary_tiles(project);
			CREATE INDEX ON pdm_boundary_tiles USING GIST(geom);

			-- Filtered tiles function for pg_tileserv
			CREATE OR REPLACE FUNCTION pdm_boundary_project_tiles(z integer, x integer, y integer, project_id varchar) RETURNS bytea AS $$
			DECLARE
				result bytea;
			BEGIN
				WITH bounds AS (
					SELECT ST_TileEnvelope(z, x, y) AS geom
				),
				mvtgeom AS (
					SELECT
						ST_AsMVTGeom(t.geom, bounds.geom) AS geom,
						t.boundary, t.name, t.admin_level, t.stats, t.nb
					FROM pdm_boundary_tiles t, bounds
					WHERE
						t.project = project_id
						AND CASE
							WHEN z < 5 THEN t.admin_level = 4
							WHEN z >= 5 AND z < 8 THEN t.admin_level = 6
							WHEN z >= 8 THEN t.admin_level = 8
						END
						AND ST_Intersects(t.geom, bounds.geom)
				)
				SELECT ST_AsMVT(mvtgeom, 'public.pdm_boundary_project_tiles') INTO result
				FROM mvtgeom;

				RETURN result;
			END;
			$$
			LANGUAGE 'plpgsql' STABLE PARALLEL SAFE;
		""")
			

else:
	print("Skipped Imposm processing")


print("Done!")
