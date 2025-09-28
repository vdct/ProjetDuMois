-- Insert unknown changes from pdm_changes_tmp and associate them with enclosing boundaries
ALTER TABLE pdm_features_boundary SET UNLOGGED;
WITH unknown AS (
	SELECT pc.osmid AS osmid,
	pc.version as version,
	b.osm_id AS boundary
	FROM pdm_changes_tmp pc
	JOIN pdm_boundary_subdivide b ON ST_Intersects(pc.geom, b.geom)
	LEFT JOIN pdm_features_boundary fb ON fb.project=:project_id AND fb.osmid=pc.osmid AND fb.version=pc.version AND fb.boundary=b.osm_id
	WHERE fb.osmid IS NULL
)
INSERT INTO pdm_features_boundary
SELECT :project_id AS project, u.osmid AS osmid, u.version, u.boundary
FROM unknown u;

ALTER TABLE pdm_features_boundary SET LOGGED;
REINDEX table pdm_features_boundary;