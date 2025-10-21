-- Boundary subdivide
CREATE MATERIALIZED VIEW pdm_boundary_subdivide AS
SELECT id, osm_id, name, admin_level, tags, ST_Subdivide(ST_Transform(geom, 4326), 450) AS geom
FROM pdm_boundary;

CREATE INDEX ON pdm_boundary_subdivide using gist(geom);
CREATE INDEX ON pdm_boundary_subdivide using btree(osm_id);

-- Boundary stats for tiles
CREATE MATERIALIZED VIEW pdm_boundary_tiles AS
WITH minc AS (
	SELECT DISTINCT ON (project_id, boundary) project_id, boundary, label, amount
	FROM pdm_feature_counts_per_boundary
	ORDER BY project_id, boundary, label, ts
),
maxc AS (
	SELECT DISTINCT ON (project_id, boundary) project_id, boundary, label, amount
	FROM pdm_feature_counts_per_boundary
	ORDER BY project_id, boundary, label, ts DESC
),
stats AS (
	SELECT project_id, boundary, label, json_object(array_agg(ts::date::text), array_agg(amount::text)) AS stats
	FROM pdm_feature_counts_per_boundary
	GROUP BY project_id, boundary, label
)
SELECT s.project_id, s.boundary, s.label, b.id, b.name, b.admin_level, s.stats, maxc.amount - minc.amount AS nb, b.centre AS geom
FROM stats s
JOIN minc ON minc.project_id = s.project_id AND minc.boundary = s.boundary AND minc.label=s.label
JOIN maxc ON maxc.project_id = s.project_id AND maxc.boundary = s.boundary AND minc.label=s.label
JOIN pdm_boundary b ON s.boundary = b.osm_id;

CREATE INDEX pdm_boundary_tiles_project_idx ON pdm_boundary_tiles(project_id);
CREATE INDEX pdm_boundary_tiles_geom_idx ON pdm_boundary_tiles USING GIST(geom);

-- Filtered tiles function for pg_tileserv
CREATE OR REPLACE FUNCTION pdm_boundary_project_tiles(z integer, x integer, y integer, prjid int) RETURNS bytea AS $$
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
			t.project_id = prjid
			AND t.label IS NULL
			AND CASE
				WHEN z < 5 THEN t.admin_level <= 4
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
