-- Boundary subdivide
CREATE MATERIALIZED VIEW pdm_boundary_subdivide AS 
SELECT id, osm_id, type, name, admin_level, tags, ST_Subdivide(geom, 450) AS geom
FROM pdm_boundary;

  CREATE INDEX ON pdm_boundary_subdivide using gist(geom);
  CREATE INDEX ON pdm_boundary_subdivide using btree(osm_id);

-- Boundary stats for tiles
CREATE MATERIALIZED VIEW pdm_boundary_tiles AS
SELECT
	s.project, s.boundary, b.name, b.admin_level,
	json_object(array_agg(s.ts::date::text), array_agg(s.amount::text)) AS stats,
	MAX(s.amount) AS nb,
	b.centre AS geom
FROM pdm_feature_counts_per_boundary s
JOIN pdm_boundary b ON s.boundary = b.osm_id
GROUP BY s.project, s.boundary, b.name, b.admin_level, b.centre
ORDER BY s.project, b.admin_level;

CREATE INDEX pdm_boundary_tiles_project_idx ON pdm_boundary_tiles(project);
CREATE INDEX pdm_boundary_tiles_geom_idx ON pdm_boundary_tiles USING GIST(geom);
