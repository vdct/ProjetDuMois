-- Boundary stats for tiles
CREATE MATERIALIZED VIEW pdm_boundary_tiles AS
SELECT
	s.project, s.boundary, b.name, b.admin_level,
	json_object(array_agg(s.day::text), array_agg(s.amount::text)) AS stats,
	(array_agg(s.amount))[array_upper(array_agg(s.amount), 1)] AS nb,
	ST_PointOnSurface(b.geom)::GEOMETRY(Point, 3857) AS geom
FROM pdm_feature_counts_per_boundary s
JOIN pdm_boundary b ON s.boundary = b.osm_id
GROUP BY s.project, s.boundary, b.name, b.admin_level, b.geom
ORDER BY s.project, b.admin_level;

CREATE INDEX pdm_boundary_tiles_project_idx ON pdm_boundary_tiles(project);
CREATE INDEX pdm_boundary_tiles_geom_idx ON pdm_boundary_tiles USING GIST(geom);
