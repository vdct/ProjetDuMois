-- Boundary subdivide
CREATE MATERIALIZED VIEW pdm_boundary_subdivide AS
SELECT id, osm_id, name, admin_level, tags, ST_Subdivide(geom, 450) AS geom
FROM pdm_boundary;

CREATE INDEX ON pdm_boundary_subdivide using gist(geom);
CREATE INDEX ON pdm_boundary_subdivide using btree(osm_id);

-- Boundary stats for tiles
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

CREATE INDEX pdm_boundary_tiles_project_idx ON pdm_boundary_tiles(project);
CREATE INDEX pdm_boundary_tiles_geom_idx ON pdm_boundary_tiles USING GIST(geom);

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
